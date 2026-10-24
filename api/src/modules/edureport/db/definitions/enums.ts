import type {
  AssignmentKind,
  AttendanceStatus,
  ReportStatus,
  SubmissionStatus,
} from "../../@types/index.ts";

// Schema enums from the @types unions. Records make tsc reject a missing or
// extra value, so the stored values cannot drift from the contract.
const values = <T extends string>(record: Record<T, true>) => Object.keys(record) as T[];

export const ATTENDANCE_STATUSES = values<AttendanceStatus>({
  present: true,
  absent: true,
  late: true,
  excused: true,
});

export const ASSIGNMENT_KINDS = values<AssignmentKind>({ task: true, essay: true });

export const SUBMISSION_STATUSES = values<SubmissionStatus>({
  submitted: true,
  queued: true,
  aiDrafted: true,
  failed: true,
  approved: true,
});

export const REPORT_STATUSES = values<ReportStatus>({
  draft: true,
  generating: true,
  ready: true,
  failed: true,
  approved: true,
});

export const RISK_REASONS = values<"attendance" | "score">({ attendance: true, score: true });
