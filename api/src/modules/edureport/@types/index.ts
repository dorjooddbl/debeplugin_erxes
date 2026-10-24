import type { Document, Model } from "mongoose";

// Data contract: docs/SPEC.md §3, names unchanged. Every _id is a string
// (mongooseStringRandomId) and every schema has timestamps. `date`, `dueDate`,
// `periodFrom` and `periodTo` are real calendar dates as 'YYYY-MM-DD'.

export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type AssignmentKind = "task" | "essay";
export type SubmissionStatus = "submitted" | "queued" | "aiDrafted" | "failed" | "approved";
export type ReportStatus = "draft" | "generating" | "ready" | "failed" | "approved";

interface IDocBase {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------- Classes (collection: edureport_classes)
export interface IClass {
  name: string;
  subject: string;
  term: string;
  grade?: string;
  teacherId: string;
  atRiskAttendancePct?: number; // 0–100, 80 when unset
  atRiskScorePct?: number; // 0–100, 60 when unset
}
export interface IClassDocument extends IClass, IDocBase, Document<string> {}
export interface IClassModel extends Model<IClassDocument> {
  getClass(_id: string): Promise<IClassDocument>;
  createClass(doc: IClass): Promise<IClassDocument>;
  updateClass(_id: string, doc: Partial<Omit<IClass, "teacherId">>): Promise<IClassDocument>;
  // Also removes the class's students, attendances, assignments, submissions and reports.
  removeClass(_id: string): Promise<void>;
}

// ---------- Students (edureport_students, unique: classId + code)
export interface IStudent {
  classId: string;
  name: string;
  code: string;
  customerId?: string;
}
export interface IStudentDocument extends IStudent, IDocBase, Document<string> {}
export interface IStudentModel extends Model<IStudentDocument> {
  listByClass(classId: string): Promise<IStudentDocument[]>;
  // Skips codes the class already has.
  bulkInsertStudents(
    classId: string,
    rows: { name: string; code: string }[],
  ): Promise<{ inserted: number; skippedCodes: string[] }>;
}

// ---------- Attendances (edureport_attendances, unique: classId + studentId + date)
export interface IAttendance {
  classId: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  markedBy: string;
}
export interface IAttendanceDocument extends IAttendance, IDocBase, Document<string> {}
export interface IAttendanceModel extends Model<IAttendanceDocument> {
  // Upsert.
  bulkMark(
    classId: string,
    date: string,
    entries: { studentId: string; status: AttendanceStatus }[],
    markedBy: string,
  ): Promise<number>;
  listByRange(classId: string, from: string, to: string): Promise<IAttendanceDocument[]>;
}

// ---------- Rubrics (edureport_rubrics)
export interface IRubricCriterion {
  key: string;
  title: string;
  description: string;
  levels: string[];
}
export interface IRubric {
  name: string;
  teacherId: string;
  criteria: IRubricCriterion[];
}
export interface IRubricDocument extends IRubric, IDocBase, Document<string> {}
export interface IRubricModel extends Model<IRubricDocument> {
  getRubric(_id: string): Promise<IRubricDocument>;
  // Creates when _id is undefined.
  saveRubric(_id: string | undefined, doc: IRubric): Promise<IRubricDocument>;
}

// ---------- Assignments (edureport_assignments)
export interface IAssignment {
  classId: string;
  title: string;
  kind: AssignmentKind;
  maxScore: number;
  rubricId?: string; // required when kind === 'essay'
  dueDate?: string;
}
export interface IAssignmentDocument extends IAssignment, IDocBase, Document<string> {}
export interface IAssignmentModel extends Model<IAssignmentDocument> {
  getAssignment(_id: string): Promise<IAssignmentDocument>;
  createAssignment(doc: IAssignment): Promise<IAssignmentDocument>;
  listByClass(classId: string): Promise<IAssignmentDocument[]>;
}

// ---------- Submissions (edureport_submissions, unique: assignmentId + studentId)
export interface ICriterionFeedback {
  criterionKey: string;
  strengths: string[];
  improvements: string[];
  evidenceQuote?: string;
}
export interface IAiDraft {
  criteria: ICriterionFeedback[];
  model: string;
  generatedAt: Date;
}
export interface ISubmission {
  assignmentId: string;
  classId: string;
  studentId: string;
  text?: string; // essays
  aiDraft?: IAiDraft;
  teacherFeedback?: string;
  score?: number; // written ONLY by approve / setScores
  status: SubmissionStatus;
  error?: string;
  queuedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
}
export interface ISubmissionDocument extends ISubmission, IDocBase, Document<string> {}
export interface ISubmissionModel extends Model<ISubmissionDocument> {
  getSubmission(_id: string): Promise<ISubmissionDocument>;
  // Added + replaced count; rules in the SPEC §3 status table.
  bulkAdd(
    assignmentId: string,
    classId: string,
    items: { studentId: string; text: string }[],
  ): Promise<number>;
  markQueued(ids: string[]): Promise<string[]>; // the _ids that actually became queued
  saveAiDraft(_id: string, draft: IAiDraft): Promise<void>; // queued → aiDrafted only
  markFailed(_id: string, error: string): Promise<void>; // queued → failed only
  approve(
    _id: string,
    a: { teacherFeedback: string; score: number; approvedBy: string },
  ): Promise<ISubmissionDocument>; // → approved
  // kind === 'task'; upsert { score, status: 'approved', approvedBy, approvedAt }
  setScores(
    assignmentId: string,
    classId: string,
    entries: { studentId: string; score: number }[],
    approvedBy: string,
  ): Promise<number>;
}

// ---------- Reports (edureport_reports)
export interface IStudentMetric {
  studentId: string;
  attendanceRate: number | null;
  avgScorePct: number | null;
  atRisk: boolean;
  reasons: ("attendance" | "score")[];
}
export interface IReportMetrics {
  studentCount: number;
  sessions: number;
  attendanceRate: number | null;
  avgScorePct: number | null;
  perStudent: IStudentMetric[];
  atRiskStudentIds: string[];
}
export interface IReport {
  classId: string;
  periodFrom: string;
  periodTo: string;
  createdBy: string;
  status: ReportStatus;
  metrics?: IReportMetrics;
  aiSummary?: string;
  warnings?: string[];
  teacherText?: string;
  error?: string;
  approvedBy?: string;
  approvedAt?: Date;
}
export interface IReportDocument extends IReport, IDocBase, Document<string> {}
export interface IReportModel extends Model<IReportDocument> {
  getReport(_id: string): Promise<IReportDocument>;
  createDraft(classId: string, from: string, to: string, createdBy: string): Promise<IReportDocument>;
  markGenerating(_id: string, metrics: IReportMetrics): Promise<void>;
  saveGenerated(_id: string, r: { aiSummary: string; warnings: string[] }): Promise<void>; // → ready
  markFailed(_id: string, error: string): Promise<void>;
  updateText(_id: string, teacherText: string): Promise<IReportDocument>; // ready only
  approve(_id: string, approvedBy: string): Promise<IReportDocument>; // ready only
}
