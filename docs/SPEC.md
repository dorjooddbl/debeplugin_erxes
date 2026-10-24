# edureport_api — SPEC (эх сурвалж үнэн)

Энэ файл standalone плагины repo-ийн `docs/SPEC.md` замд байна (erxes monorepo-оос гадуур).
Claude Code prompt бүр энэ файлыг уншаад ажиллана. Энд бичигдээгүй зүйлийг
өөрөө зохиохгүй, эргэлзвэл асууна. Шийдвэр өөрчлөгдвөл кодтой нэг өөрчлөлтөөр
энэ файлыг шинэчилнэ.

## 1. Зорилго

Багшийн ажлын бүтээмжийг нэмэгдүүлж, бичиг цааснаас үүдэх стрессийг бууруулах.
Хоёр функц:

- **A. Тайлан үүсгэгч** — ирц, даалгаврын оноог нэгтгэж улирлын тайлан + AI чанарын дүгнэлт.
- **B. Эссэний санал хүсэлтийн туслах** — rubric-ийн дагуу AI ноорог, багш засаж батална.

**Үндсэн дүрэм:** AI хэзээ ч оноо өгөхгүй. Оноог зөвхөн багш бичнэ. Тайлангийн
тоог зөвхөн код тооцно, AI тоо зохиохгүй.

## 2. Бүтэц

Плагины нэр `edureport`, нэг модуль `edureport`, порт `3306` (бүгд `erxes.json`-оос).

```
erxes.json                     плагины нэр, порт (API, UI хоёулаа уншина)
AGENTS.md
docs/SPEC.md                   ← энэ файл
docs/DEMO.md                   демо GraphQL дараалал
ui/                            frontend (Module Federation remote)
api/                           edureport_api
  src/
    main.ts                    startPlugin({ name, port }) — erxes.json-оос
    connectionResolvers.ts     IModels, IContext, loadClasses, generateModels
    meta/permissions.ts
    apollo/                    typeDefs.ts, schema/, resolvers/, subscription.cjs
    worker/                    index.ts, feedbackWorker.ts, reportWorker.ts
    seed/seed.ts               демо өгөгдөл
    modules/edureport/
      @types/                  өгөгдлийн гэрээ (§3)
      db/definitions/          Mongoose schema
      db/models/               static методтой модель
      graphql/schemas/
      graphql/resolvers/
      services/                access.ts, validation.ts, metrics.ts, llm.ts, prompts.ts,
                               guards.ts, progress.ts, feedback.ts, report.ts
    __tests__/
```

Хэв маяг (erxes monorepo-ийн `backend/plugins/` дотор): `insurance_api` (энгийн нэг модуль), `sales_api` (static методтой модель,
permission, subscription), `loyalty_api/src/worker` (BullMQ, `createMQWorkerWithListeners`).

## 3. Өгөгдлийн гэрээ (@types)

Бүх `_id` нь `mongooseStringRandomId`, бүх schema `timestamps: true`.
Огноо (`date`, `dueDate`, `periodFrom`, `periodTo`) нь `'YYYY-MM-DD'` string бөгөөд
бодит календарийн огноо байна (`2026-02-30` буруу).

```ts
import { Document, Model } from 'mongoose';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type AssignmentKind = 'task' | 'essay';
export type SubmissionStatus = 'submitted' | 'queued' | 'aiDrafted' | 'failed' | 'approved';
export type ReportStatus = 'draft' | 'generating' | 'ready' | 'failed' | 'approved';

interface IDocBase { _id: string; createdAt: Date; updatedAt: Date }

// ---------- Classes  (collection: edureport_classes)
export interface IClass {
  name: string;            // "7Б"
  subject: string;         // "Монгол хэл"
  term: string;            // "2026-2027 I улирал"
  grade?: string;
  teacherId: string;       // erxes user._id
  atRiskAttendancePct?: number;  // 0–100, байхгүй бол 80
  atRiskScorePct?: number;       // 0–100, байхгүй бол 60
}
export interface IClassDocument extends IClass, IDocBase, Document<string> {}
export interface IClassModel extends Model<IClassDocument> {
  getClass(_id: string): Promise<IClassDocument>;                 // олдохгүй бол throw
  createClass(doc: IClass): Promise<IClassDocument>;
  updateClass(_id: string, doc: Partial<Omit<IClass, 'teacherId'>>): Promise<IClassDocument>;
  removeClass(_id: string): Promise<void>;
  // students, attendances, assignments, submissions, reports-оос classId-тай бүгдийг устгана
}

// ---------- Students  (edureport_students, unique: classId + code)
export interface IStudent { classId: string; name: string; code: string; customerId?: string }
export interface IStudentDocument extends IStudent, IDocBase, Document<string> {}
export interface IStudentModel extends Model<IStudentDocument> {
  listByClass(classId: string): Promise<IStudentDocument[]>;
  bulkInsertStudents(classId: string, rows: { name: string; code: string }[]):
    Promise<{ inserted: number; skippedCodes: string[] }>;       // code давхардвал алгасна
}

// ---------- Attendances  (edureport_attendances, unique: classId + studentId + date)
export interface IAttendance {
  classId: string; studentId: string; date: string; status: AttendanceStatus; markedBy: string;
}
export interface IAttendanceDocument extends IAttendance, IDocBase, Document<string> {}
export interface IAttendanceModel extends Model<IAttendanceDocument> {
  bulkMark(classId: string, date: string,
    entries: { studentId: string; status: AttendanceStatus }[], markedBy: string): Promise<number>; // upsert
  listByRange(classId: string, from: string, to: string): Promise<IAttendanceDocument[]>;
}

// ---------- Rubrics  (edureport_rubrics)
export interface IRubricCriterion { key: string; title: string; description: string; levels: string[] }
export interface IRubric { name: string; teacherId: string; criteria: IRubricCriterion[] }
export interface IRubricDocument extends IRubric, IDocBase, Document<string> {}
export interface IRubricModel extends Model<IRubricDocument> {
  getRubric(_id: string): Promise<IRubricDocument>;
  saveRubric(_id: string | undefined, doc: IRubric): Promise<IRubricDocument>; // _id байхгүй бол шинээр
}

// ---------- Assignments  (edureport_assignments)
export interface IAssignment {
  classId: string; title: string; kind: AssignmentKind; maxScore: number;
  rubricId?: string;       // kind === 'essay' бол заавал
  dueDate?: string;
}
export interface IAssignmentDocument extends IAssignment, IDocBase, Document<string> {}
export interface IAssignmentModel extends Model<IAssignmentDocument> {
  getAssignment(_id: string): Promise<IAssignmentDocument>;
  createAssignment(doc: IAssignment): Promise<IAssignmentDocument>;
  listByClass(classId: string): Promise<IAssignmentDocument[]>;
}

// ---------- Submissions  (edureport_submissions, unique: assignmentId + studentId)
export interface ICriterionFeedback {
  criterionKey: string; strengths: string[]; improvements: string[]; evidenceQuote?: string;
}
export interface IAiDraft { criteria: ICriterionFeedback[]; model: string; generatedAt: Date }
export interface ISubmission {
  assignmentId: string; classId: string; studentId: string;
  text?: string;                 // essay-д
  aiDraft?: IAiDraft;
  teacherFeedback?: string;
  score?: number;                // ЗӨВХӨН approve / setScores бичнэ
  status: SubmissionStatus;
  error?: string;
  queuedAt?: Date;
  approvedBy?: string; approvedAt?: Date;
}
export interface ISubmissionDocument extends ISubmission, IDocBase, Document<string> {}
export interface ISubmissionModel extends Model<ISubmissionDocument> {
  getSubmission(_id: string): Promise<ISubmissionDocument>;
  bulkAdd(assignmentId: string, classId: string, items: { studentId: string; text: string }[]): Promise<number>;
  // нэмсэн + шинэчилсэн тоо; дүрмийг доорх төлвийн хүснэгтээс үз
  markQueued(ids: string[]): Promise<string[]>;                  // бодитоор queued болсон _id-ууд
  saveAiDraft(_id: string, draft: IAiDraft): Promise<void>;     // зөвхөн queued → aiDrafted
  markFailed(_id: string, error: string): Promise<void>;        // зөвхөн queued → failed
  approve(_id: string, a: { teacherFeedback: string; score: number; approvedBy: string }):
    Promise<ISubmissionDocument>;                                // → approved
  setScores(assignmentId: string, classId: string,
    entries: { studentId: string; score: number }[], approvedBy: string): Promise<number>;
  // kind === 'task'; upsert { score, status: 'approved', approvedBy, approvedAt }
}

// ---------- Reports  (edureport_reports)
export interface IStudentMetric {
  studentId: string; attendanceRate: number | null; avgScorePct: number | null;
  atRisk: boolean; reasons: ('attendance' | 'score')[];
}
export interface IReportMetrics {
  studentCount: number; sessions: number;
  attendanceRate: number | null; avgScorePct: number | null;
  perStudent: IStudentMetric[]; atRiskStudentIds: string[];
}
export interface IReport {
  classId: string; periodFrom: string; periodTo: string; createdBy: string;
  status: ReportStatus;
  metrics?: IReportMetrics; aiSummary?: string; warnings?: string[]; teacherText?: string;
  error?: string; approvedBy?: string; approvedAt?: Date;
}
export interface IReportDocument extends IReport, IDocBase, Document<string> {}
export interface IReportModel extends Model<IReportDocument> {
  getReport(_id: string): Promise<IReportDocument>;
  createDraft(classId: string, from: string, to: string, createdBy: string): Promise<IReportDocument>;
  markGenerating(_id: string, metrics: IReportMetrics): Promise<void>;
  saveGenerated(_id: string, r: { aiSummary: string; warnings: string[] }): Promise<void>; // → ready
  markFailed(_id: string, error: string): Promise<void>;
  updateText(_id: string, teacherText: string): Promise<IReportDocument>;  // зөвхөн ready
  approve(_id: string, approvedBy: string): Promise<IReportDocument>;      // зөвхөн ready
}
```

`IModels` дахь нэрс: `Classes, Students, Attendances, Rubrics, Assignments, Submissions, Reports`.

### Submission-ий төлөв

| Үйлдэл | Эхлэх төлөв | Дараах төлөв |
|---|---|---|
| `bulkAdd`, шинэ сурагч | — | `submitted` |
| `bulkAdd`, байгаа submission | `submitted`, `failed`, `aiDrafted` | `submitted` (text солигдож, `aiDraft`, `error` цэвэрлэгдэнэ) |
| `bulkAdd`, байгаа submission | `queued`, `approved` | өөрчлөгдөхгүй, тоонд орохгүй |
| `markQueued` | `submitted`, `failed`, `aiDrafted` | `queued` (`queuedAt` бичнэ) |
| `saveAiDraft` | `queued` | `aiDrafted` |
| `markFailed` | `queued` | `failed` |
| `approve` (зөвхөн essay) | `submitted`, `aiDrafted`, `failed`, `approved` | `approved` |
| `setScores` (зөвхөн task) | байхгүй эсвэл `approved` | `approved` |

`queued` төлөвтэй submission-ийг approve хийхгүй ("AI ноорог боловсруулагдаж байна").
`queuedAt`-аас хойш 30 минутаас дээш `queued` хэвээр байвал гацсан гэж үзэж
`markQueued` дахин авна.

### Тайлангийн төлөв

| Үйлдэл | Эхлэх төлөв | Дараах төлөв |
|---|---|---|
| `createDraft` | — | `draft` |
| `markGenerating` | `draft` | `generating` |
| `saveGenerated` | `generating` | `ready` |
| `markFailed` | `draft`, `generating` | `failed` |
| `updateText` | `ready` | `ready` |
| `approve` | `ready` | `approved`; `teacherText` хоосон бол `aiSummary`-г хуулна |

Батлагдсан тайланг засахгүй. Шинэ тайлан хүсвэл дахин `edureportReportGenerate`.

## 4. Permission (`meta/permissions.ts`)

`plugin: 'edureport'`, нэг module `edureport`, `ownerFields: ['teacherId']`, scope `own`, `all`.

| Action | Утга |
|---|---|
| showClasses (always) | Харах |
| classesViewAll | Бүх багшийн ангийг харах, засах |
| classesManage | Анги, сурагч |
| attendanceMark | Ирц тэмдэглэх |
| assignmentsManage | Шалгуур, даалгавар, эссэ оруулах |
| feedbackGenerate | AI санал хүсэлт эхлүүлэх |
| submissionsApprove | Оноо тавих, батлах |
| reportsManage | Тайлан үүсгэх, засах |
| reportsApprove | Тайлан батлах |

erxes-ийн `checkPermission(action)` зөвхөн зөвшөөрсөн/хориглосон гэж хариулдаг,
scope-ийг resolver-т өгдөггүй. Тиймээс "бүх анги" эрхийг `classesViewAll` үйлдлээр илэрхийлнэ:

- `user.isOwner` эсвэл `classesViewAll` эрхтэй → бүх анги.
- Бусад нь зөвхөн `teacherId === user._id` ангид хандана.
- Хандах эрхгүй бол "Анги олдсонгүй" гэж буцаана (байгаа эсэхийг задлахгүй).
- Rubric нь багшийнх: жагсаалт өөрийнхийг (owner, `classesViewAll` бол бүгдийг) харуулна,
  `edureportRubricSave` зөвхөн өөрийн rubric-ийг засна.

Анхдагч бүлгүүд (`defaultGroups`):

- `edureport:teacher` — `classesViewAll`-аас бусад бүх үйлдэл, scope `own`.
- `edureport:admin` — бүх үйлдэл, scope `all`.

## 5. GraphQL операцууд

Нэр бүр `edureport` угтвартай. Q = query, M = mutation, S = subscription.

| Op | Нэр | Оролт | Буцаах | Permission |
|---|---|---|---|---|
| Q | edureportClassList | term?, page?, perPage? | { list, totalCount } | showClasses |
| Q | edureportClassDetail | _id | Class (+ studentCount) | showClasses |
| M | edureportClassAdd | name, subject, term, grade? | Class | classesManage |
| M | edureportClassEdit | _id, name?, subject?, term?, grade?, atRiskAttendancePct?, atRiskScorePct? | Class | classesManage |
| M | edureportClassRemove | _id | Boolean | classesManage |
| Q | edureportStudentList | classId | [Student] | showClasses |
| M | edureportStudentsImport | classId, rows [{ name, code }] | { inserted, skippedCodes, errors [{ row, message }] } | classesManage |
| Q | edureportAttendanceList | classId, from, to | [Attendance] | showClasses |
| M | edureportAttendanceMark | classId, date, entries [{ studentId, status }] | Int | attendanceMark |
| Q | edureportAttendanceSummary | classId, from, to | [{ studentId, rate, absences, lates }] | showClasses |
| Q | edureportRubricList | — | [Rubric] | showClasses |
| M | edureportRubricSave | _id?, name, criteria | Rubric | assignmentsManage |
| Q | edureportAssignmentList | classId | [Assignment] | showClasses |
| M | edureportAssignmentAdd | classId, title, kind, maxScore, rubricId?, dueDate? | Assignment | assignmentsManage |
| M | edureportScoresSet | assignmentId, entries [{ studentId, score }] | Int | submissionsApprove |
| Q | edureportSubmissionList | assignmentId, status? | [Submission] | showClasses |
| Q | edureportSubmissionDetail | _id | Submission | showClasses |
| M | edureportSubmissionsAdd | assignmentId, items [{ studentId, text }] | Int | assignmentsManage |
| M | edureportFeedbackGenerate | assignmentId, submissionIds? | { jobId, queued } | feedbackGenerate |
| M | edureportSubmissionApprove | _id, teacherFeedback, score | Submission | submissionsApprove |
| M | edureportReportGenerate | classId, from, to | { reportId, jobId } | reportsManage |
| Q | edureportReportDetail | _id | Report | showClasses |
| Q | edureportReportList | classId | [Report] | showClasses |
| M | edureportReportEdit | _id, teacherText | Report | reportsManage |
| M | edureportReportApprove | _id | Report | reportsApprove |
| Q | edureportJobStatus | jobId | { total, done, failed, finished } | showClasses |
| S | edureportJobProgress | jobId | { total, done, failed, finished, lastId } | нэвтэрсэн хэрэглэгч |

`rate` (AttendanceSummary) нь §6-ийн `attendanceRate`-тай адил 0–100 хувь.

Validation (бүгд `ExpectedError`, мессеж монголоор):
- score: 0 ≤ score ≤ maxScore. maxScore > 0. date: бодит `YYYY-MM-DD`, from ≤ to.
- atRiskAttendancePct, atRiskScorePct: 0–100.
- essay даалгавар rubricId-гүй бол алдаа; rubric нь даалгавар нэмж буй хэрэглэгчийнх байна.
- Сурагч тухайн ангид харьяалагдахгүй бол алдаа.
- StudentsImport: мөр тус бүрийг Zod-оор шалгаж, буруу мөрийг `errors`-д буцаана, бусдыг оруулна.
- RubricSave: шалгуур 1–8, `key` давхардахгүй.
- Нэг дуудлагад: entries ≤ 200, items ≤ 100, rows ≤ 200, essay text ≤ 20 000 тэмдэгт.

FeedbackGenerate: зөвхөн essay даалгавар. `submissionIds` байхгүй бол бүх `submitted`,
`failed` болон гацсан `queued` submission; өгсөн бол тэдгээрээс `markQueued`-ийн дүрмээр
шилжих боломжтойг нь. `queued` = бодитоор дараалалд орсон тоо.

JobStatus, JobProgress: `jobId` нь хүсэлтийн subdomain-ээр эхлээгүй, эсвэл тухайн job-ийн
ангид хандах эрхгүй бол "Ажил олдсонгүй". Subscription нь gateway дотор ажилладаг тул
плагины модель ашиглахгүй: нэвтэрсэн хэрэглэгч, subdomain-ийн угтвар хоёрыг шалгана.

## 6. Metrics дүрэм (`services/metrics.ts`, цэвэр функц)

Бүх хувь 0–100. Харьцуулалтыг бөөрөнхийлөхөөс өмнө хийж, гаралтын тоог 1 оронгоор бөөрөнхийлнө.

- **Ирц (сурагч):** attendanceRate = (present + late) / (бүх тэмдэглэгээ − excused) × 100.
  Хуваагч 0 бол `null`.
- **Тооцох даалгавар:** тухайн ангийн даалгавар, огноо нь (`dueDate`, байхгүй бол `createdAt`-ийн
  огноо) [from, to] дотор, мөн тайлан үүсгэсэн өдрөөс хойш биш.
- **Оноо (сурагч, даалгавар бүрт):** `approved` submission → score / maxScore × 100.
  Submission огт байхгүй → 0 (тараагүй ажил). Submission байгаа ч `approved` биш → тооцохгүй
  (багш шалгаж амжаагүй).
- **avgScorePct (сурагч):** тооцсон даалгавруудын дундаж. Нэг ч байхгүй бол `null`.
- **Ангийн attendanceRate:** бүх сурагчийн тэмдэглэгээг нийлүүлж дээрх томьёогоор.
- **Ангийн avgScorePct:** бүх сурагчийн тооцсон (сурагч, даалгавар) утгуудын дундаж.
- **atRisk:** attendanceRate < class.atRiskAttendancePct (80) эсвэл avgScorePct < class.atRiskScorePct (60).
  `null` бол тухайн шалгуураар atRisk биш.
- **sessions** = тухайн хугацааны ялгаатай `date`-ийн тоо. **studentCount** = ангийн сурагчийн тоо.

## 7. AI дүрэм

- LLM: OpenAI (алхам 7-оос өмнө эцэслэн батална). env: `EDUREPORT_OPENAI_API_KEY`,
  `EDUREPORT_LLM_MODEL` (default `gpt-4o-mini`).
  Түлхүүр байхгүй бол AI мутаци ойлгомжтой ExpectedError өгнө, плагин унахгүй.
- `ai` (erxes monorepo-ийн root-д байгаа хувилбар) + `@ai-sdk/openai` (хоёуланг нь зөвхөн `api/`-д нэмнэ) → бүтэцтэй
  гаралт + Zod. edureport_api нь CommonJS тул эхлээд нэг дуудлага `build`, `dev:api`, jest-д
  ажиллахыг батална.
- LLM рүү сурагчийн нэр биш `code`-ийг илгээнэ.
- **Feedback schema-д score/grade талбар БАЙХГҮЙ.**
- `guards.ts`:
  - `evidenceQuote` нь эссэнд (whitespace normalize хийсний дараа) агуулагдахгүй бол хоосолно.
  - Дүн илрүүлэлтийг зөвхөн `strengths`, `improvements` текстэд хийнэ (`evidenceQuote` нь
    эссэний ишлэл тул хамаарахгүй). Хэв маяг: `\d+\s*/\s*\d+`, `\d+\s*оноо`,
    латин болон кирилл үсгийн дүн (`A–F`, `А`, `В`, `С`, `Д`) + `дүн`/`үнэлгээ`,
    `\d+(?:[.,]\d+)?\s*%`. Илэрвэл нэг удаа дахин үүсгэнэ, дахиад бол `failed`.
  - Тайлангийн `aiSummary`-д metrics-д байхгүй тоо байвал `warnings[]`-д тэмдэглэнэ (устгахгүй).
    Зөвшөөрөгдөх тоо: metrics-ийн утгууд, studentCount, sessions, хугацааны огноо,
    анги/улирлын нэрэн дэх тоо, мөрийн эхэн дэх гарчгийн дугаар. Тоог `85,3` → `85.3`,
    `%`-гүйгээр харьцуулна.
- Queue: `edureport-feedback`, `edureport-report` (BullMQ, Redis = erxes-ийн redis). Concurrency 3,
  LLM timeout 30 с. Сүлжээ/timeout алдаанд BullMQ 3 оролдлого (exponential backoff 5 с);
  эцсийн алдаа → `markFailed`. Job data-д `subdomain` заавал байна.
- Явц: jobId = `${subdomain}:${type}:${randomId}` (BullMQ-ийн job id биш). Redis hash
  `{ total, done, failed, classId }`, 24 цаг TTL. Submission/тайлан бүрийг эцсийн үр дүнд нэг л
  удаа тоолно (дахин оролдлого давхар тоолохгүй). Өөрчлөгдөх бүрт `edureportJobProgress:${jobId}`-д
  publish.
- Prompt текстүүдийг `services/prompts.ts`-д төвлөрүүлнэ. Хариулт монгол хэлээр.

## 8. Чанарын дүрэм

- `any` хэрэглэхгүй, named export, plugin-ээс гадуур файл засахгүй (`ENABLED_PLUGINS` тохиргооноос бусад).
- Бүх өгөгдөл `generateModels(subdomain)`-оор. Business rule модель/service-д, resolver нимгэн.
- Тест `MONGO_URL`-ийг хэзээ ч ашиглахгүй. Бодит Mongo шаардсан тест зөвхөн
  `EDUREPORT_TEST_MONGO_URL` тохируулсан үед ажиллаж, бусад үед skip хийнэ.
- Алхам бүрийн төгсгөлд (Node 22): `pnpm run check`, `pnpm run lint`, `pnpm run build`,
  `pnpm run test` бүгд алдаагүй.
- AGENTS.md-г шинэчилнэ (зөвхөн тогтвортой баримт, task journal биш).
