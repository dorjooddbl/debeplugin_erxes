# edureport_api — SPEC (эх сурвалж үнэн)

Энэ файлыг `backend/plugins/edureport_api/docs/SPEC.md` замд хадгална.
Claude Code prompt бүр энэ файлыг уншаад ажиллана. Энд бичигдээгүй зүйлийг
өөрөө зохиохгүй, эргэлзвэл асууна.

## 1. Зорилго

Багшийн ажлын бүтээмжийг нэмэгдүүлж, бичиг цааснаас үүдэх стрессийг бууруулах.
Хоёр функц:

- **A. Тайлан үүсгэгч** — ирц, даалгаврын оноог нэгтгэж улирлын тайлан + AI чанарын дүгнэлт.
- **B. Эссэний санал хүсэлтийн туслах** — rubric-ийн дагуу AI ноорог, багш засаж батална.

**Үндсэн дүрэм:** AI хэзээ ч оноо өгөхгүй. Оноог зөвхөн багш бичнэ. Тайлангийн
тоог зөвхөн код тооцно, AI тоо зохиохгүй.

## 2. Бүтэц

Плагины нэр `edureport`, нэг модуль `edureport`.

```
backend/plugins/edureport_api/
  docs/SPEC.md                 ← энэ файл
  AGENTS.md
  src/
    main.ts                    startPlugin({ name: 'edureport', ... })
    connectionResolvers.ts     IModels, loadClasses, generateModels
    meta/permissions.ts
    apollo/                    typeDefs.ts, resolvers/
    worker/                    index.ts, feedbackWorker.ts, reportWorker.ts
    modules/edureport/
      @types/                  ← НАЙЗ + ТА хамтдаа (гэрээ)
      db/definitions/          ← НАЙЗ
      db/models/               ← НАЙЗ
      graphql/schemas/         ← ТА
      graphql/resolvers/       ← ТА
      services/                ← ТА (metrics.ts, llm.ts, guards.ts, feedback.ts, report.ts)
  src/__tests__/
```

Хэв маяг: `insurance_api` (энгийн нэг модуль), `sales_api` (static методтой модель,
permission), `loyalty_api/src/worker` (BullMQ).

## 3. Өгөгдлийн гэрээ (@types)

Бүх `_id` нь `mongooseStringRandomId`, бүх schema `timestamps: true`.
Огноо (`date`, `periodFrom`, `periodTo`) нь `'YYYY-MM-DD'` string.

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
  atRiskAttendancePct?: number;  // default 80
  atRiskScorePct?: number;       // default 60
}
export interface IClassDocument extends IClass, IDocBase, Document<string> {}
export interface IClassModel extends Model<IClassDocument> {
  getClass(_id: string): Promise<IClassDocument>;                 // олдохгүй бол throw
  createClass(doc: IClass): Promise<IClassDocument>;
  updateClass(_id: string, doc: Partial<Omit<IClass, 'teacherId'>>): Promise<IClassDocument>;
  removeClass(_id: string): Promise<void>;                        // холбоотой бүх өгөгдлийг устгана
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
  approvedBy?: string; approvedAt?: Date;
}
export interface ISubmissionDocument extends ISubmission, IDocBase, Document<string> {}
export interface ISubmissionModel extends Model<ISubmissionDocument> {
  getSubmission(_id: string): Promise<ISubmissionDocument>;
  bulkAdd(assignmentId: string, classId: string, items: { studentId: string; text: string }[]): Promise<number>;
  markQueued(ids: string[]): Promise<number>;
  saveAiDraft(_id: string, draft: IAiDraft): Promise<void>;     // status → aiDrafted
  markFailed(_id: string, error: string): Promise<void>;
  approve(_id: string, a: { teacherFeedback: string; score: number; approvedBy: string }):
    Promise<ISubmissionDocument>;                                // status → approved
  setScores(assignmentId: string, classId: string,
    entries: { studentId: string; score: number }[], approvedBy: string): Promise<number>; // kind === 'task'
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
  updateText(_id: string, teacherText: string): Promise<IReportDocument>;  // approved бол throw
  approve(_id: string, approvedBy: string): Promise<IReportDocument>;      // зөвхөн ready-г
}
```

`IModels` дахь нэрс: `Classes, Students, Attendances, Rubrics, Assignments, Submissions, Reports`.

## 4. Permission (`meta/permissions.ts`)

`plugin: 'edureport'`, нэг module `edureport`, `ownerFields: ['teacherId']`, scope `own`, `all`.

| Action | Утга |
|---|---|
| showClasses (always) | Харах |
| classesManage | Анги, сурагч |
| attendanceMark | Ирц тэмдэглэх |
| assignmentsManage | Шалгуур, даалгавар, эссэ оруулах |
| feedbackGenerate | AI санал хүсэлт эхлүүлэх |
| submissionsApprove | Оноо тавих, батлах |
| reportsManage | Тайлан үүсгэх, засах |
| reportsApprove | Тайлан батлах |

Анги-тай холбоотой бүх resolver: `all` scope-гүй хэрэглэгч зөвхөн `teacherId === user._id` ангид хандана.
Хандах эрхгүй бол "олдсонгүй" гэж буцаана (байгаа эсэхийг задлахгүй).

## 5. GraphQL операцууд

Нэр бүр `edureport` угтвартай. Q = query, M = mutation, S = subscription.

| Op | Нэр | Оролт | Буцаах | Permission |
|---|---|---|---|---|
| Q | edureportClassList | term?, page?, perPage? | { list, totalCount } | showClasses |
| Q | edureportClassDetail | _id | Class (+ studentCount) | showClasses |
| M | edureportClassAdd | name, subject, term, grade? | Class | classesManage |
| M | edureportClassEdit | _id, name?, subject?, term?, grade?, atRisk…? | Class | classesManage |
| M | edureportClassRemove | _id | Boolean | classesManage |
| Q | edureportStudentList | classId | [Student] | showClasses |
| M | edureportStudentsImport | classId, rows [{ name, code }] | { inserted, skippedCodes, errors [{ row, message }] } | classesManage |
| Q | edureportAttendanceList | classId, from, to | [Attendance] | showClasses |
| M | edureportAttendanceMark | classId, date, entries [{ studentId, status }] | Int | attendanceMark |
| Q | edureportAttendanceSummary | classId, from, to | [{ studentId, rate, absences, lates }] | showClasses |
| Q | edureportRubricList | — | [Rubric] (өөрийнх) | showClasses |
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
| S | edureportJobProgress | jobId | { total, done, failed, finished, lastId } | showClasses |

Validation (бүгд ExpectedError, мессеж монголоор):
- score: 0 ≤ score ≤ maxScore. date: `YYYY-MM-DD`, from ≤ to.
- essay даалгавар rubricId-гүй бол алдаа. Сурагч тухайн ангид харьяалагдахгүй бол алдаа.
- StudentsImport: мөр тус бүрийг Zod-оор шалгаж, буруу мөрийг `errors`-д буцаана, бусдыг оруулна.
- Нэг дуудлагад: entries ≤ 200, items ≤ 100, essay text ≤ 20 000 тэмдэгт.

## 6. Metrics дүрэм (`services/metrics.ts`, цэвэр функц)

- attendanceRate = (present + late) / (бүх тэмдэглэгээ − excused). Хуваагч 0 бол `null`.
- avgScorePct = Σ(score / maxScore) / тоо × 100, зөвхөн `approved` submission. Байхгүй бол `null`.
- atRisk: attendanceRate < class.atRiskAttendancePct (80) эсвэл avgScorePct < class.atRiskScorePct (60). `null` бол тухайн шалгуураар atRisk биш.
- sessions = тухайн хугацааны ялгаатай `date`-ийн тоо. Тоог 1 оронгоор бөөрөнхийлнө.

## 7. AI дүрэм

- LLM: OpenAI. env: `EDUREPORT_OPENAI_API_KEY`, `EDUREPORT_LLM_MODEL` (default `gpt-4o-mini`).
  Түлхүүр байхгүй бол AI мутаци ойлгомжтой ExpectedError өгнө, плагин унахгүй.
- `ai` (root-д байгаа хувилбар) + `@ai-sdk/openai` (зөвхөн edureport_api-д нэмнэ) → `generateObject` + Zod.
- LLM рүү сурагчийн нэр биш `code`-ийг илгээнэ.
- **Feedback schema-д score/grade талбар БАЙХГҮЙ.**
- `guards.ts`:
  - `evidenceQuote` нь эссэнд (whitespace normalize хийсний дараа) агуулагдахгүй бол хоосолно.
  - Текстэнд дүн илэрвэл (`\d+\s*/\s*\d+`, `\d+\s*оноо`, `\b[A-F][+-]?\s*дүн`, `%`-тай оноо) → нэг удаа дахин оролдоно, дахиад бол `failed`.
  - Тайлангийн `aiSummary`-д metrics-д байхгүй тоо байвал `warnings[]`-д тэмдэглэнэ (устгахгүй).
- Queue: `edureport-feedback`, `edureport-report` (BullMQ, Redis = erxes-ийн redis). Concurrency 3, LLM timeout 30 с.
- Явц: Redis pub/sub → `edureportJobProgress`. jobId = `${subdomain}:${type}:${randomId}`, явцыг Redis hash-д 24 цаг хадгална.
- Prompt текстүүдийг `services/prompts.ts`-д төвлөрүүлнэ. Хариулт монгол хэлээр.

## 8. Чанарын дүрэм

- `any` хэрэглэхгүй, named export, plugin-ээс гадуур файл засахгүй (`ENABLED_PLUGINS` тохиргооноос бусад).
- Бүх өгөгдөл `generateModels(subdomain)`-оор. Business rule модель/service-д, resolver нимгэн.
- Алхам бүрийн төгсгөлд: `pnpm nx run edureport_api:typecheck` (байвал), `pnpm nx lint edureport_api`,
  `pnpm nx build edureport_api`, `pnpm nx test edureport_api` бүгд алдаагүй.
- AGENTS.md-г шинэчилнэ (зөвхөн тогтвортой баримт, task journal биш).
