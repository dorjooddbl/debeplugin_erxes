# edureport

EduReport: term reports and rubric-based essay feedback drafts for teachers.
The AI drafts; the teacher edits, scores and approves. AI never writes a score,
and report numbers come only from code.

**`docs/SPEC.md` is the source of truth** for the data contract, operations,
permissions, metric rules and AI rules. Do not invent behavior it does not
describe; ask instead. A change that departs from it updates the spec in the
same change.

An erxes plugin outside the erxes monorepo: `api/` (Node.js 22,
erxes-api-shared startPlugin + tenant-scoped Mongoose models (Node.js)) and `ui/` (React 18 Module Federation remote). `erxes.json`
is the single source of the plugin's identity and ports (API `3306`, UI `3099`).
The erxes host (core-api, gateway, core-ui) runs from an erxes monorepo
checkout whose `.env` lists `edureport` in `ENABLED_PLUGINS`.

## Structure

| Path | Responsibility |
| --- | --- |
| `api/src/main.ts` | `startPlugin` with name and port from `erxes.json`; tenant models on the context. |
| `api/src/connectionResolvers.ts` | `IModels`, `IContext`, `generateModels`. |
| `api/src/apollo/` | `typeDefs.ts`, `schema/` and `resolvers/` merge the module's schema and resolvers; `subscription.ts`. |
| `api/src/modules/edureport/` | `@types/` (SPEC §3), `db/definitions/`, `db/models/`, `graphql/schemas/`, `graphql/resolvers/`, `services/`. |
| `api/src/meta/permissions.ts` | Permission config (SPEC §4). |
| `api/src/worker/` | BullMQ `edureport-feedback` and `edureport-report` workers (SPEC §7). |
| `api/src/seed/seed.ts` | Demo data. |
| `api/src/__tests__/` | Jest tests (`*.test.ts`). They never use `MONGO_URL`; real-Mongo tests run only with `EDUREPORT_TEST_MONGO_URL`. |
| `ui/` | Module Federation remote mounted by core-ui at `/edureport/*`. |

## Commands

Use Node 22 (`mise use node@22`; `mise.toml` is excluded from git).

- `pnpm install`
- `pnpm run dev:api` / `pnpm run dev:ui`
- `pnpm run codegen`
- `pnpm run check`, `pnpm run lint`, `pnpm run build`, `pnpm run test`, `pnpm run fmt`
- `docker build --build-arg UI_ENTRY_URL=<remoteEntry.js URL> -t <image> .`

Run `check`, `lint`, `build` and `test` before calling a change done.
pnpm settings (`overrides`, `allowBuilds`) live in `pnpm-workspace.yaml`;
pnpm 12 ignores the `pnpm` field in `package.json`.

## Naming invariants

See `docs/erxes-integration.md`. In short:

- `erxes.json` `name` (`edureport`) drives Redis keys, `ENABLED_PLUGINS`, the
  docker host `plugin-edureport-api` and the CDN folder `edureport_ui`.
- `ui.name` (`edureport`) is `CONFIG.name`, the page expose `./edureport`,
  and the API permission identity. Keep the public name, including dashes;
  `ui.remote` (`edureport_ui`) is what core-api derives from `name`.
- Change names only in `erxes.json`, and only all together.

## Contracts

- `api/src/main.ts` boots through erxes-api-shared `startPlugin`, which owns
  gateway registration (including `UI_ENTRY_URL`), `/health`, `/graphql`,
  gateway-header parsing and — in production — the router-update BullMQ job.
- Tenant data goes through `generateModels(subdomain, context)` onto `context.models`;
  never connect to Mongo directly. `checkPermission(action)` is on the context.
- Prefix every GraphQL type with `Edureport` and every operation and root
  field with `edureport`; the supergraph is shared by all plugins.
- `ui/src/config.tsx` exports `CONFIG`; `ui/src/Main.tsx` exports `Edureport`;
  the only baseline exposes are `./config` and `./edureport`. The plugin owns
  `/edureport/settings` and its sidebar through `AppLayout`; the host does not
  mount a separate settings expose. Keep `ui/rspack.config.ts` in sync with
  `erxes.json`. Add notification widgets only when implementing notifications.
- `api/src/print-schema.ts` prints `typeDefs` from `api/src/apollo/typeDefs.ts` to `api/generated/schema.graphql`.
- `erxes-api-shared/utils` connects to Mongo when `createGenerateModels` runs, so
  tests import schemas, resolvers and services, never `connectionResolvers.ts`
  or `main.ts`.
- `erxes-ui`, `ui-modules` and `erxes-api-shared` are the npm packages
  `@erxes/ui`, `@erxes/ui-modules` and `@erxes/api-shared`, installed under
  those import names with exact npm aliases. The tested cohort is
  `3.3.2`; update all three together and validate the deployment.

## Rules

- No `any`; named exports (default export only where a tool requires it, e.g.
  `rspack.config.ts`).
- The `hostShared` list in `ui/rspack.config.ts` (`react`, `react-dom`,
  `react-router`, `react-router-dom`, `@apollo/client`, `jotai`,
  `react-i18next`, `erxes-ui`, `ui-modules`) mirrors core-ui's shared
  singletons: they stay `import: false` and are never bundled — the host
  provides them at runtime. Keep the list in sync with core-ui's
  `coreLibraries`.
- `erxes-ui`/`ui-modules` imports resolve to the shared singleton at runtime,
  so the installed versions should match the host's — they only decide what
  TypeScript and Rspack resolve against.
- UI classes use the `edureport:` Tailwind prefix and the host tokens
  (`bg-background`, `text-muted-foreground`, `border-border`, …).
- Authorize in the API using `context.user`; the UI route guard is not a
  security boundary. Platform data resolvers must also await
  `checkPermission(action)` and use tenant-bound models and bounded pagination.
  Forwarded identity/tenant headers are trusted gateway assertions, not
  authentication: keep API ports private and strip client identity headers at
  the public ingress. See the integration docs before deployment.
- Every query has loading, error and empty states; refetch or update the
  Apollo cache after each mutation.
- GraphQL documents are `gql()` from `~/gql` — generated into `ui/src/gql/`
  by `codegen` from `api/generated/schema.graphql` — written as a function
  call on a static string with no `${}` interpolation.
- Apollo hooks infer their types from the document: no `useQuery<T>` or
  `useMutation<T>` generics and no handwritten response interfaces; derive
  types from the generated `*Query` types.
- `api/generated` and `ui/src/gql` are gitignored; `check`, `build` and
  `dev:ui` run `codegen` first. Run `pnpm run codegen` after changing a
  document or the schema.
