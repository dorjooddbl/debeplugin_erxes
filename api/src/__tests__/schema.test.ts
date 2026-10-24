import { buildSchema, type GraphQLFieldMap } from "graphql";
import { printClientSdl } from "../apollo/clientSdl.ts";
import { SPEC_MUTATIONS, SPEC_QUERIES, SPEC_SUBSCRIPTIONS } from "./helpers/spec.ts";

// The SDL `pnpm run codegen` prints to api/generated/schema.graphql.
const schema = buildSchema(printClientSdl());

const pluginFields = <TSource, TContext>(fields?: GraphQLFieldMap<TSource, TContext>) =>
  Object.keys(fields ?? {})
    .filter((name) => name.startsWith("edureport"))
    .sort();

describe("printed schema", () => {
  it("has exactly the SPEC §5 queries", () => {
    expect(pluginFields(schema.getQueryType()?.getFields())).toEqual(
      Object.keys(SPEC_QUERIES).sort(),
    );
  });

  it("has exactly the SPEC §5 mutations", () => {
    expect(pluginFields(schema.getMutationType()?.getFields())).toEqual(
      Object.keys(SPEC_MUTATIONS).sort(),
    );
  });

  it("has exactly the SPEC §5 subscriptions", () => {
    expect(pluginFields(schema.getSubscriptionType()?.getFields())).toEqual(
      [...SPEC_SUBSCRIPTIONS].sort(),
    );
  });

  it("has all 27 operations", () => {
    const count = [schema.getQueryType(), schema.getMutationType(), schema.getSubscriptionType()]
      .map((type) => pluginFields(type?.getFields()).length)
      .reduce((sum, n) => sum + n, 0);

    expect(count).toBe(27);
  });

  it("prefixes every type it declares with Edureport", () => {
    const shared = new Set(["String", "Int", "Float", "Boolean", "ID", "Date"]);
    const roots = new Set(["Query", "Mutation", "Subscription"]);

    const unprefixed = Object.keys(schema.getTypeMap()).filter(
      (name) =>
        !name.startsWith("Edureport") &&
        !shared.has(name) &&
        !roots.has(name) &&
        // Federation and introspection types: _Service, link__Import, __Type, …
        !name.startsWith("_") &&
        !name.includes("__"),
    );

    expect(unprefixed).toEqual([]);
  });
});
