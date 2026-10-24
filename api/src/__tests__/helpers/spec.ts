// docs/SPEC.md §4 and §5, copied by hand so tests compare the code against
// the spec rather than against itself. Update together with the SPEC.

export const SPEC_ACTIONS = [
  "showClasses",
  "classesViewAll",
  "classesManage",
  "attendanceMark",
  "assignmentsManage",
  "feedbackGenerate",
  "submissionsApprove",
  "reportsManage",
  "reportsApprove",
];

// Operation → permission action.
export const SPEC_QUERIES: Record<string, string> = {
  edureportClassList: "showClasses",
  edureportClassDetail: "showClasses",
  edureportStudentList: "showClasses",
  edureportAttendanceList: "showClasses",
  edureportAttendanceSummary: "showClasses",
  edureportRubricList: "showClasses",
  edureportAssignmentList: "showClasses",
  edureportSubmissionList: "showClasses",
  edureportSubmissionDetail: "showClasses",
  edureportReportDetail: "showClasses",
  edureportReportList: "showClasses",
  edureportJobStatus: "showClasses",
};

export const SPEC_MUTATIONS: Record<string, string> = {
  edureportClassAdd: "classesManage",
  edureportClassEdit: "classesManage",
  edureportClassRemove: "classesManage",
  edureportStudentsImport: "classesManage",
  edureportAttendanceMark: "attendanceMark",
  edureportRubricSave: "assignmentsManage",
  edureportAssignmentAdd: "assignmentsManage",
  edureportScoresSet: "submissionsApprove",
  edureportSubmissionsAdd: "assignmentsManage",
  edureportFeedbackGenerate: "feedbackGenerate",
  edureportSubmissionApprove: "submissionsApprove",
  edureportReportGenerate: "reportsManage",
  edureportReportEdit: "reportsManage",
  edureportReportApprove: "reportsApprove",
};

// Resolved in the gateway for any signed-in user (no plugin permission).
export const SPEC_SUBSCRIPTIONS = ["edureportJobProgress"];
