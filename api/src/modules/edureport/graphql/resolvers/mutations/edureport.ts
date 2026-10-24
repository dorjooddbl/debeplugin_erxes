import { notImplemented } from "../notImplemented.ts";

// Permission per operation: docs/SPEC.md §5.
export const edureportMutations = {
  edureportClassAdd: notImplemented("classesManage"),
  edureportClassEdit: notImplemented("classesManage"),
  edureportClassRemove: notImplemented("classesManage"),
  edureportStudentsImport: notImplemented("classesManage"),
  edureportAttendanceMark: notImplemented("attendanceMark"),
  edureportRubricSave: notImplemented("assignmentsManage"),
  edureportAssignmentAdd: notImplemented("assignmentsManage"),
  edureportScoresSet: notImplemented("submissionsApprove"),
  edureportSubmissionsAdd: notImplemented("assignmentsManage"),
  edureportFeedbackGenerate: notImplemented("feedbackGenerate"),
  edureportSubmissionApprove: notImplemented("submissionsApprove"),
  edureportReportGenerate: notImplemented("reportsManage"),
  edureportReportEdit: notImplemented("reportsManage"),
  edureportReportApprove: notImplemented("reportsApprove"),
};
