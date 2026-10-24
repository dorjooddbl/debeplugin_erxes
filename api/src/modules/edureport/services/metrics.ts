import type {
  AttendanceStatus,
  IAssignment,
  IClass,
  IReportMetrics,
  IStudentMetric,
  ISubmission,
} from "../@types/index.ts";

// Pure report metrics: docs/SPEC.md §6. No database access: callers load the
// records, this only counts. Every percentage is 0–100; comparisons use the
// exact value and only the returned numbers are rounded to one decimal.

const DEFAULT_ATTENDANCE_THRESHOLD = 80;
const DEFAULT_SCORE_THRESHOLD = 60;

export interface MetricsInput {
  cls: Pick<IClass, "atRiskAttendancePct" | "atRiskScorePct">;
  students: { _id: string }[];
  attendances: { studentId: string; date: string; status: AttendanceStatus }[];
  assignments: (Pick<IAssignment, "maxScore" | "dueDate"> & { _id: string; createdAt: Date })[];
  submissions: Pick<ISubmission, "assignmentId" | "studentId" | "status" | "score">[];
  // Inclusive 'YYYY-MM-DD' period, and the day the report is made.
  from: string;
  to: string;
  today: string;
}

export const round1 = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;

const roundOrNull = (value: number | null) => (value === null ? null : round1(value));

const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

// (present + late) / (marks − excused) × 100; null when nothing counts.
const attendanceRate = (statuses: AttendanceStatus[]) => {
  const counted = statuses.filter((status) => status !== "excused");
  const attended = counted.filter((status) => status === "present" || status === "late").length;

  return counted.length ? (attended / counted.length) * 100 : null;
};

const inPeriod = (date: string, from: string, to: string) => date >= from && date <= to;

// An assignment counts by its dueDate, or the day it was created.
const assignmentDay = ({ dueDate, createdAt }: MetricsInput["assignments"][number]) =>
  dueDate ?? createdAt.toISOString().slice(0, 10);

const statusesByStudent = (attendances: MetricsInput["attendances"]) => {
  const byStudent = new Map<string, AttendanceStatus[]>();

  for (const { studentId, status } of attendances) {
    byStudent.set(studentId, [...(byStudent.get(studentId) ?? []), status]);
  }

  return byStudent;
};

export const computeClassMetrics = (input: MetricsInput): IReportMetrics => {
  const { cls, students, from, to, today } = input;
  const attendanceThreshold = cls.atRiskAttendancePct ?? DEFAULT_ATTENDANCE_THRESHOLD;
  const scoreThreshold = cls.atRiskScorePct ?? DEFAULT_SCORE_THRESHOLD;

  const attendances = input.attendances.filter(({ date }) => inPeriod(date, from, to));
  const assignments = input.assignments.filter((assignment) => {
    const day = assignmentDay(assignment);

    return inPeriod(day, from, to) && day <= today;
  });
  const submissionOf = new Map(
    input.submissions.map((submission) => [`${submission.assignmentId}:${submission.studentId}`, submission]),
  );
  const marks = statusesByStudent(attendances);

  // Per (student, assignment): approved → its share of maxScore; none at all
  // → 0 (work not handed in); present but not approved → not counted yet.
  const scoresOf = (studentId: string) =>
    assignments.flatMap((assignment) => {
      const submission = submissionOf.get(`${assignment._id}:${studentId}`);

      if (!submission) {
        return [0];
      }

      return submission.status === "approved" && typeof submission.score === "number"
        ? [(submission.score / assignment.maxScore) * 100]
        : [];
    });

  const allScores: number[] = [];

  const perStudent: IStudentMetric[] = students.map(({ _id }) => {
    const rate = attendanceRate(marks.get(_id) ?? []);
    const scores = scoresOf(_id);
    const avg = mean(scores);
    const reasons: IStudentMetric["reasons"] = [];

    allScores.push(...scores);

    if (rate !== null && rate < attendanceThreshold) {
      reasons.push("attendance");
    }

    if (avg !== null && avg < scoreThreshold) {
      reasons.push("score");
    }

    return {
      studentId: _id,
      attendanceRate: roundOrNull(rate),
      avgScorePct: roundOrNull(avg),
      atRisk: reasons.length > 0,
      reasons,
    };
  });

  const studentIds = new Set(students.map(({ _id }) => _id));

  return {
    studentCount: students.length,
    sessions: new Set(attendances.map(({ date }) => date)).size,
    attendanceRate: roundOrNull(
      attendanceRate(attendances.filter(({ studentId }) => studentIds.has(studentId)).map(({ status }) => status)),
    ),
    avgScorePct: roundOrNull(mean(allScores)),
    perStudent,
    atRiskStudentIds: perStudent.filter(({ atRisk }) => atRisk).map(({ studentId }) => studentId),
  };
};

// edureportAttendanceSummary: each student's rate (as attendanceRate above),
// absences and lates over the period.
export const summarizeAttendance = (
  students: { _id: string }[],
  attendances: MetricsInput["attendances"],
  from: string,
  to: string,
) => {
  const marks = statusesByStudent(attendances.filter(({ date }) => inPeriod(date, from, to)));

  return students.map(({ _id }) => {
    const statuses = marks.get(_id) ?? [];

    return {
      studentId: _id,
      rate: roundOrNull(attendanceRate(statuses)),
      absences: statuses.filter((status) => status === "absent").length,
      lates: statuses.filter((status) => status === "late").length,
    };
  });
};
