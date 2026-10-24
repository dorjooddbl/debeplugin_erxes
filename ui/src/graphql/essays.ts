import { gql } from "~/gql";

export const RUBRIC_LIST = gql(`
  query edureportRubricList {
    edureportRubricList {
      _id
      name
      teacherId
      criteria {
        key
        title
        description
        levels
      }
    }
  }
`);

export const RUBRIC_SAVE = gql(`
  mutation edureportRubricSave($_id: String, $name: String!, $criteria: [EdureportRubricCriterionInput!]!) {
    edureportRubricSave(_id: $_id, name: $name, criteria: $criteria) {
      _id
      name
    }
  }
`);

export const ASSIGNMENT_LIST = gql(`
  query edureportAssignmentList($classId: String!) {
    edureportAssignmentList(classId: $classId) {
      _id
      title
      kind
      maxScore
      rubricId
      dueDate
    }
  }
`);

export const ASSIGNMENT_ADD = gql(`
  mutation edureportAssignmentAdd(
    $classId: String!
    $title: String!
    $kind: EdureportAssignmentKind!
    $maxScore: Float!
    $rubricId: String
    $dueDate: String
  ) {
    edureportAssignmentAdd(
      classId: $classId
      title: $title
      kind: $kind
      maxScore: $maxScore
      rubricId: $rubricId
      dueDate: $dueDate
    ) {
      _id
    }
  }
`);

export const SUBMISSION_LIST = gql(`
  query edureportSubmissionList($assignmentId: String!, $status: EdureportSubmissionStatus) {
    edureportSubmissionList(assignmentId: $assignmentId, status: $status) {
      _id
      studentId
      status
      score
      error
      updatedAt
    }
  }
`);

export const SUBMISSION_DETAIL = gql(`
  query edureportSubmissionDetail($_id: String!) {
    edureportSubmissionDetail(_id: $_id) {
      _id
      studentId
      text
      status
      score
      error
      teacherFeedback
      approvedAt
      aiDraft {
        model
        generatedAt
        criteria {
          criterionKey
          strengths
          improvements
          evidenceQuote
        }
      }
    }
  }
`);

export const SUBMISSIONS_ADD = gql(`
  mutation edureportSubmissionsAdd($assignmentId: String!, $items: [EdureportSubmissionItemInput!]!) {
    edureportSubmissionsAdd(assignmentId: $assignmentId, items: $items)
  }
`);

export const SUBMISSION_APPROVE = gql(`
  mutation edureportSubmissionApprove($_id: String!, $teacherFeedback: String!, $score: Float!) {
    edureportSubmissionApprove(_id: $_id, teacherFeedback: $teacherFeedback, score: $score) {
      _id
      status
      score
      teacherFeedback
      approvedAt
    }
  }
`);

export const SCORES_SET = gql(`
  mutation edureportScoresSet($assignmentId: String!, $entries: [EdureportScoreEntryInput!]!) {
    edureportScoresSet(assignmentId: $assignmentId, entries: $entries)
  }
`);

export const FEEDBACK_GENERATE = gql(`
  mutation edureportFeedbackGenerate($assignmentId: String!, $submissionIds: [String!]) {
    edureportFeedbackGenerate(assignmentId: $assignmentId, submissionIds: $submissionIds) {
      jobId
      queued
    }
  }
`);

export const JOB_STATUS = gql(`
  query edureportJobStatus($jobId: String!) {
    edureportJobStatus(jobId: $jobId) {
      total
      done
      failed
      finished
    }
  }
`);
