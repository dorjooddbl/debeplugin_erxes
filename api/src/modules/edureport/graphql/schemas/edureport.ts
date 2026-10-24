// Operations and types from docs/SPEC.md §3 and §5. Fields follow the data
// contract: required there is non-null here. Dates named date, dueDate,
// periodFrom and periodTo are 'YYYY-MM-DD' strings; timestamps are Date.
export const types = `
  enum EdureportAttendanceStatus {
    present
    absent
    late
    excused
  }

  enum EdureportAssignmentKind {
    task
    essay
  }

  enum EdureportSubmissionStatus {
    submitted
    queued
    aiDrafted
    failed
    approved
  }

  enum EdureportReportStatus {
    draft
    generating
    ready
    failed
    approved
  }

  enum EdureportRiskReason {
    attendance
    score
  }

  type EdureportClass {
    _id: String!
    name: String!
    subject: String!
    term: String!
    grade: String
    teacherId: String!
    atRiskAttendancePct: Float
    atRiskScorePct: Float
    studentCount: Int!
    createdAt: Date!
    updatedAt: Date!
  }

  type EdureportClassListResponse {
    list: [EdureportClass!]!
    totalCount: Int!
  }

  type EdureportStudent {
    _id: String!
    classId: String!
    name: String!
    code: String!
    customerId: String
    createdAt: Date!
    updatedAt: Date!
  }

  input EdureportStudentRowInput {
    name: String!
    code: String!
  }

  type EdureportImportError {
    row: Int!
    message: String!
  }

  type EdureportStudentsImportResult {
    inserted: Int!
    skippedCodes: [String!]!
    errors: [EdureportImportError!]!
  }

  type EdureportAttendance {
    _id: String!
    classId: String!
    studentId: String!
    date: String!
    status: EdureportAttendanceStatus!
    markedBy: String!
    createdAt: Date!
    updatedAt: Date!
  }

  input EdureportAttendanceEntryInput {
    studentId: String!
    status: EdureportAttendanceStatus!
  }

  type EdureportAttendanceSummary {
    studentId: String!
    rate: Float
    absences: Int!
    lates: Int!
  }

  type EdureportRubricCriterion {
    key: String!
    title: String!
    description: String!
    levels: [String!]!
  }

  input EdureportRubricCriterionInput {
    key: String!
    title: String!
    description: String!
    levels: [String!]!
  }

  type EdureportRubric {
    _id: String!
    name: String!
    teacherId: String!
    criteria: [EdureportRubricCriterion!]!
    createdAt: Date!
    updatedAt: Date!
  }

  type EdureportAssignment {
    _id: String!
    classId: String!
    title: String!
    kind: EdureportAssignmentKind!
    maxScore: Float!
    rubricId: String
    dueDate: String
    createdAt: Date!
    updatedAt: Date!
  }

  input EdureportScoreEntryInput {
    studentId: String!
    score: Float!
  }

  type EdureportCriterionFeedback {
    criterionKey: String!
    strengths: [String!]!
    improvements: [String!]!
    evidenceQuote: String
  }

  type EdureportAiDraft {
    criteria: [EdureportCriterionFeedback!]!
    model: String!
    generatedAt: Date!
  }

  type EdureportSubmission {
    _id: String!
    assignmentId: String!
    classId: String!
    studentId: String!
    text: String
    aiDraft: EdureportAiDraft
    teacherFeedback: String
    score: Float
    status: EdureportSubmissionStatus!
    error: String
    queuedAt: Date
    approvedBy: String
    approvedAt: Date
    createdAt: Date!
    updatedAt: Date!
  }

  input EdureportSubmissionItemInput {
    studentId: String!
    text: String!
  }

  type EdureportFeedbackJob {
    jobId: String!
    queued: Int!
  }

  type EdureportStudentMetric {
    studentId: String!
    attendanceRate: Float
    avgScorePct: Float
    atRisk: Boolean!
    reasons: [EdureportRiskReason!]!
  }

  type EdureportReportMetrics {
    studentCount: Int!
    sessions: Int!
    attendanceRate: Float
    avgScorePct: Float
    perStudent: [EdureportStudentMetric!]!
    atRiskStudentIds: [String!]!
  }

  type EdureportReport {
    _id: String!
    classId: String!
    periodFrom: String!
    periodTo: String!
    createdBy: String!
    status: EdureportReportStatus!
    metrics: EdureportReportMetrics
    aiSummary: String
    warnings: [String!]
    teacherText: String
    error: String
    approvedBy: String
    approvedAt: Date
    createdAt: Date!
    updatedAt: Date!
  }

  type EdureportReportJob {
    reportId: String!
    jobId: String!
  }

  type EdureportJobStatus {
    total: Int!
    done: Int!
    failed: Int!
    finished: Boolean!
  }

  # Payload of the edureportJobProgress subscription (api/src/apollo/subscription.cjs).
  # Declared here so it is part of the supergraph the gateway subscribes against.
  type EdureportJobProgress {
    total: Int!
    done: Int!
    failed: Int!
    finished: Boolean!
    lastId: String
  }
`;

export const queries = `
  edureportClassList(term: String, page: Int, perPage: Int): EdureportClassListResponse!
  edureportClassDetail(_id: String!): EdureportClass!
  edureportStudentList(classId: String!): [EdureportStudent!]!
  edureportAttendanceList(classId: String!, from: String!, to: String!): [EdureportAttendance!]!
  edureportAttendanceSummary(classId: String!, from: String!, to: String!): [EdureportAttendanceSummary!]!
  edureportRubricList: [EdureportRubric!]!
  edureportAssignmentList(classId: String!): [EdureportAssignment!]!
  edureportSubmissionList(assignmentId: String!, status: EdureportSubmissionStatus): [EdureportSubmission!]!
  edureportSubmissionDetail(_id: String!): EdureportSubmission!
  edureportReportDetail(_id: String!): EdureportReport!
  edureportReportList(classId: String!): [EdureportReport!]!
  edureportJobStatus(jobId: String!): EdureportJobStatus!
`;

export const mutations = `
  edureportClassAdd(name: String!, subject: String!, term: String!, grade: String): EdureportClass!
  edureportClassEdit(
    _id: String!
    name: String
    subject: String
    term: String
    grade: String
    atRiskAttendancePct: Float
    atRiskScorePct: Float
  ): EdureportClass!
  edureportClassRemove(_id: String!): Boolean!
  edureportStudentsImport(classId: String!, rows: [EdureportStudentRowInput!]!): EdureportStudentsImportResult!
  edureportAttendanceMark(classId: String!, date: String!, entries: [EdureportAttendanceEntryInput!]!): Int!
  edureportRubricSave(_id: String, name: String!, criteria: [EdureportRubricCriterionInput!]!): EdureportRubric!
  edureportAssignmentAdd(
    classId: String!
    title: String!
    kind: EdureportAssignmentKind!
    maxScore: Float!
    rubricId: String
    dueDate: String
  ): EdureportAssignment!
  edureportScoresSet(assignmentId: String!, entries: [EdureportScoreEntryInput!]!): Int!
  edureportSubmissionsAdd(assignmentId: String!, items: [EdureportSubmissionItemInput!]!): Int!
  edureportFeedbackGenerate(assignmentId: String!, submissionIds: [String!]): EdureportFeedbackJob!
  edureportSubmissionApprove(_id: String!, teacherFeedback: String!, score: Float!): EdureportSubmission!
  edureportReportGenerate(classId: String!, from: String!, to: String!): EdureportReportJob!
  edureportReportEdit(_id: String!, teacherText: String!): EdureportReport!
  edureportReportApprove(_id: String!): EdureportReport!
`;
