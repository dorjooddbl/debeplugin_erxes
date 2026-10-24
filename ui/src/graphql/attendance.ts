import { gql } from "~/gql";

export const ATTENDANCE_LIST = gql(`
  query edureportAttendanceList($classId: String!, $from: String!, $to: String!) {
    edureportAttendanceList(classId: $classId, from: $from, to: $to) {
      _id
      studentId
      date
      status
    }
  }
`);

export const ATTENDANCE_MARK = gql(`
  mutation edureportAttendanceMark(
    $classId: String!
    $date: String!
    $entries: [EdureportAttendanceEntryInput!]!
  ) {
    edureportAttendanceMark(classId: $classId, date: $date, entries: $entries)
  }
`);
