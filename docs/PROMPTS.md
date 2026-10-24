# edureport_api — Claude Code prompt-ууд (эхнээс дуустал)

Хэрэглэх журам:

1. Prompt-уудыг дарааллаар нь, **нэг удаад нэгийг** өг.
2. Prompt бүрийн эхэнд «Нийтлэг хэсэг»-ийг хуулж нэм.
3. Prompt дууссаны дараа «Дуусгах нөхцөл»-ийн командуудыг **өөрөө дахин ажиллуулж** шалга.
   Бүгд ногоон бол `feat/edureport-backend` branch дээр commit хийж push хий
   (жишээ: `git commit -m "feat(edureport): step 3 graphql schema"`), дараа нь дараагийн prompt руу шилж.
   Найз тань Алхам 1-ийн push-ийн дараа энэ branch-аас салаалж Алхам 2-ыг хийнэ.
4. Улаан бол Claude Code-д алдааны гаралтыг өгч «засаад бүх шалгалтыг дахин ажиллуул» гэ.

Алхам 2-ийг найз тань (MongoDB) хийнэ. Бусдыг та хийнэ. Алхам 3-аас хойш найзын
модель бэлэн болоогүй байсан ч тест mock модельтой ажиллана.

---

## Нийтлэг хэсэг (prompt бүрийн эхэнд)

```text
Чи erxes monorepo-ийн backend/plugins/edureport_api плагин дээр ажиллаж байна.
Ажил эхлэхээс өмнө уншаад дага:
- root CLAUDE.md, AGENTS.md, backend/AGENTS.md (байвал), backend/plugins/edureport_api/AGENTS.md
- backend/plugins/edureport_api/docs/SPEC.md  ← эх сурвалж үнэн. Тэнд байхгүй зүйлийг бүү зохио.
Хэв маягийг insurance_api, sales_api, loyalty_api-аас хайж дага.
Дүрэм: зөвхөн backend/plugins/edureport_api/** файлыг засна; `any` хэрэглэхгүй; named export;
бүх өгөгдөл generateModels(subdomain)-оор; шинэ dependency зөвхөн SPEC зөвшөөрсөн бол.
Эргэлзээтэй шийдвэр гарвал таамаглахгүй, надаас асуу.
Дуусахдаа: «Дуусгах нөхцөл»-ийн бүх командыг ажиллуул, алдаа гарвал засаад дахин ажиллуул,
бүгд давтал битгий зогс. Эцэст нь өөрчилсөн файлууд болон командуудын үр дүнг товч тайлагна.
Commit хийхгүй.
```

---

## Шинэ repo-д эхлэхээс өмнө (гараар, ~15 минут)

Өмнөх repo дээр тулгарсан асуудлуудыг урьдчилж шийднэ.

```bash
# 1. Repo-г clone хийж, ажлын branch үүсгэ
git clone <шинэ-repo-url> && cd <repo>
git checkout -b feat/edureport-backend

# 2. Node 22-г энэ хавтаст тогтоо (CI-тэй ижил), git-ээс гадуур
mise use node@22
echo mise.toml >> .git/info/exclude

# 3. Төлөвлөгөөний файлуудыг плагины docs руу хийх нь Алхам 1-д. Одоохондоо repo-оос ГАДНА хадгал
#    (~/edureport-plan/SPEC.md, PROMPTS.md, PLAN.md). Root-д бүү хуул.

# 4. .env (хуучин repo-оос хуулж болно) — эдгээр мөр заавал:
#    ENABLED_PLUGINS=frontline,sales            ← edureport-г Алхам 1 нэмнэ
#    NODE_OPTIONS=--max-old-space-size=4096     ← 1536 бол shared lib build OOM болно
#    MONGO_URL=...mongodb.net/erxes_<нэр>?...   ← сангийн нэр заавал
#    REDIS_HOST=localhost  REDIS_PORT=6379

# 5. Redis (Valkey) асаж байгаа эсэх
valkey-cli ping    # PONG
```

Atlas Network Access-д `138.252.29.0/24` нэмэгдсэн эсэхийг найзаасаа шалга (таны IP ээлжилдэг).

---

## Алхам 0 — Орчин шалгах

```text
Код өөрчлөхгүйгээр орчныг шалгаж, асуудал гарвал зөвхөн орчны түвшинд засна:
1. Node 22, pnpm нь root package.json-ийн packageManager-тэй таарч байгаа эсэх.
   pnpm анх удаа өөрийн хувилбарыг татахад удаан байж болно — дуусахыг хүлээ, процессыг
   бүү тасал. Тасарвал үлдсэн lock файлыг шалгаж цэвэрлэ.
2. `pnpm install --frozen-lockfile`. rover-ийн binary GitHub-аас татагдахгүй бол (удаан
   холболт) installer-ийн хүлээх замд гараар татаж байрлуулаад дахин ажиллуул.
3. .env: ENABLED_PLUGINS хоосон зайгүй, NODE_OPTIONS 4096, MONGO_URL-д сангийн нэр байгаа,
   REDIS тохиргоо. Нууц үгийг гаралтад бүү хэвлэ.
4. Redis-д PING. MongoDB-д 5 удаа дараалан ping (IP ээлжилдэг тул нэг удаа хангалтгүй),
   түр collection үүсгэж устгаж бичих эрхийг шалга.
5. `pnpm dev:apis` → gateway :4000 асаж, frontline, sales бүртгэгдэнэ.
Sudo шаардлагатай зүйл гарвал өөрөө бүү ажиллуул, надад хэл. Код бүү өөрчил.
```

**Дуусгах нөхцөл:** Redis PONG, Mongo 5/5 амжилттай, gateway :4000 асна.

---

## Алхам 1 — Плагины суурь

Эхлээд `SPEC.md`-г `backend/plugins/edureport_api/docs/SPEC.md` руу хуулна (плагин үүссэний дараа). PROMPTS.md, PLAN.md-г repo-д хийх бол `backend/plugins/edureport_api/docs/`-д.

```text
1. `pnpm create-plugin --plugin-name=edureport --module-name=edureport` ажиллуул.
   Generator frontend/plugins/edureport_ui-г бас үүсгэдэг — CLAUDE.md-ийн дүрмээр хэрэглэхгүй
   project-ийг шууд устга (frontend-ийг дараа тусад нь хийнэ).
2. Sample код (жишээ модель, edureport угтваргүй операцууд, "Hello" tRPC)-г цэвэрлэ.
   SPEC §2-ын хавтасны бүтцийг үүсгэ (хоосон файлд зөвхөн шаардлагатай export).
3. main.ts: startPlugin({ name: 'edureport', ... }). scripts/plugin-ports.js-ийн логикоор
   чөлөөт порт, placeholder үлдээхгүй.
4. Түр `edureportHealth: String` query ("ok") — Алхам 3-т устгана. IModels одоохондоо хоосон.
5. project.json: lint, build, test, typecheck, schema:print target. Байхгүйг sales_api-аас
   хуулж нэм (jest.config.ts, tsconfig.spec.json). docker-build target заасан Dockerfile
   байхгүй бол sales_api-ийнхыг нэрийг нь сольж хуул.
   src/__tests__/health.test.ts: бодит subgraph schema-г барьж query ажиллуулна.
6. .env-ийн ENABLED_PLUGINS-д edureport нэм (таслалаар, хоосон зайгүй).
7. AGENTS.md үүсгэ (CLAUDE.md-ийн загвараар): зорилго, бүтэц, docs/SPEC.md холбоос, командууд.
8. pnpm-lock.yaml-д зөвхөн edureport_api-ийн мөрүүд нэмэгдсэн эсэхийг шалга, хамааралгүй
   өөрчлөлтийг буцаа. dist/, generated/, cache commit-д орохгүйг git status-аар батал.
```

**Дуусгах нөхцөл:**

```bash
pnpm nx lint edureport_api && pnpm nx build edureport_api && pnpm nx test edureport_api
pnpm dev:apis   # gateway-ийн логт edureport бүртгэгдэнэ
# core-ui-д нэвтэрсний дараа http://localhost:4000/graphql дээр: query { edureportHealth } → "ok"
```

---

## Алхам 2 — Өгөгдлийн давхарга (НАЙЗ — MongoDB)

```text
SPEC §3-ыг яг дагаж өгөгдлийн давхаргыг хий:
1. modules/edureport/@types/*.ts — SPEC-ийн интерфэйсүүдийг ЯГ тэр нэрээр (нэр өөрчлөхгүй).
2. db/definitions/*.ts — Mongoose schema: _id mongooseStringRandomId, timestamps: true,
   enum утгууд SPEC-ээс, unique index-ууд (students: classId+code, attendances:
   classId+studentId+date, submissions: assignmentId+studentId), хайлтын index
   (classId, teacherId, assignmentId+status).
3. db/models/*.ts — loadXClass(models) хэв маягаар (sales_api/Labels.ts шиг static методууд),
   SPEC-ийн бүх методыг хэрэгжүүл. Олдохгүй бол ExpectedError('... олдсонгүй').
   bulkMark, setScores нь bulkWrite upsert. bulkInsertStudents давхардсан code-г алгасна.
   approve/setScores-оос өөр газраас score бичигдэхгүй. Report.updateText approved бол throw,
   approve зөвхөн ready-г батална. Class.removeClass холбоотой бүх collection-ийг цэвэрлэнэ.
4. connectionResolvers.ts — IModels (Classes, Students, Attendances, Rubrics, Assignments,
   Submissions, Reports), collection нэрс SPEC-ээс, generateModels = createGenerateModels.
5. src/seed/seed.ts + package.json-д "seed" script: нэг subdomain-д 1 анги "7Б", 30 сурагч
   (зохиомол нэр, code S-001…S-030), 8 долоо хоногийн ирц, 1 task даалгавар оноотой,
   1 rubric (3 шалгуур), 1 essay даалгавар, 30 богино зохиомол монгол эссэ (submitted).
   Дахин ажиллуулахад давхардахгүй (эхлээд тухайн seed өгөгдлийг цэвэрлэнэ).
6. Тест: модель бүрийн бизнес дүрмийг (approve хязгаар, updateText түгжээ, bulkInsert
   давхардал) jest-ээр шалга. Бодит Mongo хэрэгтэй тест бол MONGO_URL байхгүй үед skip хий.
```

**Дуусгах нөхцөл:**

```bash
pnpm nx lint edureport_api && pnpm nx build edureport_api && pnpm nx test edureport_api
pnpm --filter edureport_api seed   # эсвэл AGENTS.md-д бичсэн seed команд; 2 удаа ажиллуулахад алдаагүй
```

---

## Алхам 3 — GraphQL schema + permission (schema-first)

```text
1. SPEC §5-ын 27 операцын typeDefs-ийг modules/edureport/graphql/schemas/ дотор бич
   (type, input, enum бүгд edureport угтвартай). apollo/typeDefs.ts-д нэгтгэ.
   Subscription-ийг бусад плагин (sales_api/src/apollo/subscription.ts)-ийн хэв маягаар.
2. meta/permissions.ts — SPEC §4. main.ts-д meta-д холбо.
3. Resolver бүрийг үүсгэ: эхэнд checkPermission('<action>'), дараа нь одоохондоо
   `throw new ExpectedError('Хэрэгжээгүй байна')`. edureportHealth-г устга.
4. `schema:print` target ажиллаж, хэвлэгдсэн schema-д 27 операц бүгд байгааг шалгах тест бич
   (нэрсийн жагсаалтыг SPEC-ээс авч харьцуул).
```

**Дуусгах нөхцөл:**

```bash
pnpm nx lint edureport_api && pnpm nx build edureport_api && pnpm nx test edureport_api
pnpm dev:apis   # gateway supergraph compose алдаагүй, Sandbox-д 27 операц харагдана
```

---

## Алхам 4 — Анги, сурагч, ирцийн resolver-ууд

```text
Эдгээр resolver-ийг жинхэнээр хэрэгжүүл: edureportClassList, edureportClassDetail,
edureportClassAdd, edureportClassEdit, edureportClassRemove, edureportStudentList,
edureportStudentsImport, edureportAttendanceList, edureportAttendanceMark.
- services/access.ts: assertClassAccess(models, user, classId, checkPermission-ийн scope) —
  all scope-гүй бол зөвхөн өөрийн анги; эрхгүй бол "Анги олдсонгүй".
- ClassAdd: teacherId = user._id. ClassList: own scope бол зөвхөн өөрийнх, pagination.
- StudentsImport: мөр бүрийг Zod-оор, буруу мөрийг errors-д (row index + мессеж).
- AttendanceMark: date формат, entries ≤ 200, studentId бүр тухайн ангийнх эсэх; markedBy = user._id.
- Validation SPEC §5. Resolver нимгэн, дүрэм services/ эсвэл модельд.
Тест (mock models + mock context): эрхгүй багш өөр ангийг харахгүй/засахгүй; өөр subdomain-ий
өгөгдөл холилдохгүй; import-ийн буруу мөр; ирцийн давхар тэмдэглэгээ upsert болох.
```

**Дуусгах нөхцөл:** lint, build, test ногоон. Sandbox-д seed анги дээр `edureportClassList`, `edureportAttendanceMark` ажиллана.

---

## Алхам 5 — Шалгуур, даалгавар, эссэ, батлах

```text
Хэрэгжүүл: edureportRubricList, edureportRubricSave, edureportAssignmentList,
edureportAssignmentAdd, edureportScoresSet, edureportSubmissionList,
edureportSubmissionDetail, edureportSubmissionsAdd, edureportSubmissionApprove.
- RubricSave: criteria 1–8, key давхардахгүй; teacherId = user._id; бусдын rubric засахгүй.
- AssignmentAdd: essay бол rubricId заавал, rubric өөрийнх байх.
- SubmissionsAdd: items ≤ 100, text ≤ 20 000, сурагч тухайн ангийнх.
- ScoresSet: зөвхөн kind === 'task'. SubmissionApprove: зөвхөн essay, 0 ≤ score ≤ maxScore,
  teacherFeedback хоосон биш, approvedBy = user._id.
- Score-г өөр ямар ч мутаци бичихгүй гэдгийг тестээр баталгаажуул.
```

**Дуусгах нөхцөл:** lint, build, test ногоон. Sandbox-д seed эссэг approve хийхэд status = approved, score хадгалагдана.

---

## Алхам 6 — Metrics service + ирцийн хураангуй

```text
1. services/metrics.ts: computeClassMetrics({ cls, students, attendances, assignments,
   submissions }) → IReportMetrics. SPEC §6-г яг дага. Цэвэр функц (DB-гүй).
2. edureportAttendanceSummary resolver-ийг metrics-ийн туслах функцээр хэрэгжүүл.
3. Тест: хоосон анги (null), excused хасагдах, late ирсэнд тооцогдох, approved биш оноо
   тооцогдохгүй, босгыг ангийн тохиргооноос авах, бөөрөнхийлөлт.
   Seed өгөгдөлтэй адил 30 сурагчийн fixture дээр үр дүнг хатуу утгаар шалга.
```

**Дуусгах нөхцөл:** lint, build, test ногоон, metrics.ts-ийн тест coverage ≥ 90%.

---

## Алхам 7 — AI санал хүсэлт (BullMQ + GPT-4o mini)

```text
1. @ai-sdk/openai-г зөвхөн edureport_api-д нэм (root `ai` хувилбартай таарах хувилбар).
2. services/llm.ts: env EDUREPORT_OPENAI_API_KEY, EDUREPORT_LLM_MODEL (default gpt-4o-mini).
   generateStructured(schema, system, prompt) — timeout 30 с. Түлхүүр байхгүй бол ExpectedError.
3. services/prompts.ts: feedback system prompt (монгол хэлээр, багшийн туслах, оноо/дүн огт
   бичихгүй, rubric шалгуур бүрт 1–3 давуу тал, 1–3 сайжруулах санал, эссэнээс шууд ишлэл).
4. services/guards.ts: SPEC §7-ийн evidenceQuote шалгалт, дүн илрүүлэгч regex.
5. worker/: loyalty_api/src/worker-ийн хэв маягаар 'edureport-feedback' queue + worker,
   concurrency 3. Нэг job = нэг submission. Сурагчийн нэр биш code илгээ.
   Амжилттай → saveAiDraft; дүн илэрвэл нэг удаа дахин; дахиад бол markFailed.
6. Явц: jobId = `${subdomain}:feedback:${randomId}`, Redis hash { total, done, failed },
   24 цаг TTL, өөрчлөгдөх бүрт edureportJobProgress-д publish.
7. edureportFeedbackGenerate: эрх, даалгавар essay, submissionIds байхгүй бол бүх
   submitted/failed submission → markQueued → job-ууд → { jobId, queued }.
   edureportJobStatus: Redis hash-аас уншина, өөр subdomain-ий jobId-г татгалзана.
8. Тест (LLM mock): schema-д score байхгүй; зохиосон ишлэл хоосолно; "8/10" илэрвэл дахин
   оролдоод failed болно; явцын тоолуур зөв; түлхүүргүй үед ойлгомжтой алдаа.
```

**Дуусгах нөхцөл:**

```bash
pnpm nx lint edureport_api && pnpm nx build edureport_api && pnpm nx test edureport_api
# Бодит шалгалт (EDUREPORT_OPENAI_API_KEY тохируулсны дараа):
# Sandbox: edureportFeedbackGenerate(seed essay assignment) → jobId;
# edureportJobStatus ~1–2 минутад finished, 30/30 aiDrafted (эсвэл тодорхой шалтгаантай failed).
# 3 эссэний ноорогийг монгол хэлний чанараар гараар уншиж шалга.
```

---

## Алхам 8 — Тайлан үүсгэх ба батлах

```text
1. services/prompts.ts-д report prompt: зөвхөн өгсөн metrics JSON дээр тулгуурлан монгол
   хэлээр чанарын дүгнэлт (ерөнхий байдал, ахиц, анхаарах сурагчид code-оор, зөвлөмж).
   Гарчгууд: <БЕГ маягтын гарчгуудыг энд бич; байхгүй бол: 1. Ерөнхий үзүүлэлт
   2. Ирц 3. Сурлагын амжилт 4. Анхаарах сурагчид 5. Дараагийн улирлын зөвлөмж>.
2. edureportReportGenerate: эрх → createDraft → өгөгдөл ачаалж computeClassMetrics →
   markGenerating(metrics) → 'edureport-report' job → { reportId, jobId }.
3. Report worker: LLM → guards (metrics-д байхгүй тоо → warnings) → saveGenerated; алдаа → markFailed.
4. edureportReportDetail/List/Edit/Approve. Edit approved бол татгалзана; Approve зөвхөн ready.
5. Тест (LLM mock): тоо metrics-ээс ирдэг, AI-аас биш; warnings зөв; түгжээ ажиллана.
```

**Дуусгах нөхцөл:** lint, build, test ногоон. Sandbox-д seed анги дээр тайлан үүсгээд ready → approve → дахин edit хийхэд алдаа.

---

## Алхам 9 — Эцсийн шалгалт ба цэвэрлэгээ

```text
1. Бүх resolver-д checkPermission эхэнд байгаа, анги-тай холбоотой бүгд assertClassAccess
   дууддаг эсэхийг автомат тестээр шалга (resolver жагсаалтыг гүйлгэж).
2. `any`, console.log, TODO үлдсэн эсэхийг хайж цэвэрлэ.
3. SPEC §5-ын бүх операц хэрэгжсэн, "Хэрэгжээгүй" алдаа үлдээгүйг тестээр батал.
4. AGENTS.md: эцсийн бүтэц, env хувьсагчид, queue нэрс, seed/test командууд.
5. docs/DEMO.md: seed → ирц → эссэ санал хүсэлт → approve → тайлан → approve дарааллын
   GraphQL жишээнүүд (frontend баг болон демод).
```

**Дуусгах нөхцөл:**

```bash
pnpm nx lint edureport_api && pnpm nx build edureport_api && pnpm nx test edureport_api
pnpm nx affected --target=build   # таны branch бусад project-ийг эвдээгүй
```
