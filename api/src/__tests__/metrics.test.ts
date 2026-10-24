import { type MetricsInput, computeClassMetrics, summarizeAttendance } from "../modules/edureport/services/metrics.ts";

// docs/SPEC.md §6, checked against hand-computed values.

const DATES = ["2026-09-07", "2026-09-09", "2026-09-14", "2026-09-16", "2026-09-21", "2026-09-23", "2026-09-28", "2026-09-30"];
const PERIOD = { from: "2026-09-01", to: "2026-10-31", today: "2026-10-24" };

type Status = MetricsInput["attendances"][number]["status"];

const students = Array.from({ length: 30 }, (_s, index) => ({ _id: `st-${index}` }));

// 0–26 always present (8/8). 27: 4 present, 4 absent → 50. 28: 6 present,
// 1 late, 1 excused → 7/7 = 100. 29: 5 present, 2 absent, 1 excused → 5/7.
const pattern = (index: number): Status[] => {
  if (index === 27) return ["present", "present", "present", "present", "absent", "absent", "absent", "absent"];
  if (index === 28) return ["present", "present", "present", "present", "present", "present", "late", "excused"];
  if (index === 29) return ["present", "present", "present", "present", "present", "absent", "absent", "excused"];

  return DATES.map(() => "present");
};

const attendances: MetricsInput["attendances"] = [
  ...students.flatMap(({ _id }, index) => pattern(index).map((status, day) => ({ studentId: _id, date: DATES[day] ?? "", status }))),
  // Outside the period: ignored.
  { studentId: "st-0", date: "2026-08-31", status: "absent" },
];

const assignments: MetricsInput["assignments"] = [
  { _id: "task-1", maxScore: 10, dueDate: "2026-09-20", createdAt: new Date("2026-09-01T00:00:00Z") },
  // No dueDate: counted by its creation day.
  { _id: "essay-1", maxScore: 10, createdAt: new Date("2026-09-15T05:00:00Z") },
  // In the period but after the report day, and before the period: ignored.
  { _id: "task-future", maxScore: 10, dueDate: "2026-10-30", createdAt: new Date("2026-10-01T00:00:00Z") },
  { _id: "task-old", maxScore: 10, dueDate: "2026-08-20", createdAt: new Date("2026-08-01T00:00:00Z") },
];

// task-1: 8/10 approved for everyone except 27 (2/10) and 29 (nothing handed in → 0).
// essay-1: 9/10 approved for 0–14; drafted but not approved for 15–29 → not counted.
const submissions: MetricsInput["submissions"] = [
  ...students
    .filter((_s, index) => index !== 29)
    .map(({ _id }, index) => ({
      assignmentId: "task-1",
      studentId: _id,
      status: "approved" as const,
      score: index === 27 ? 2 : 8,
    })),
  ...students.map(({ _id }, index) =>
    index < 15
      ? { assignmentId: "essay-1", studentId: _id, status: "approved" as const, score: 9 }
      : { assignmentId: "essay-1", studentId: _id, status: "aiDrafted" as const },
  ),
  { assignmentId: "task-future", studentId: "st-0", status: "approved", score: 0 },
  { assignmentId: "task-old", studentId: "st-0", status: "approved", score: 0 },
];

const input = (change: Partial<MetricsInput> = {}): MetricsInput => ({
  cls: {},
  students,
  attendances,
  assignments,
  submissions,
  ...PERIOD,
  ...change,
});

describe("computeClassMetrics: 30-student class", () => {
  const metrics = computeClassMetrics(input());
  const of = (index: number) => metrics.perStudent[index];

  it("counts students and distinct lesson days in the period", () => {
    expect(metrics.studentCount).toBe(30);
    expect(metrics.sessions).toBe(8);
  });

  it("pools the class attendance: 232 attended of 238 counted marks", () => {
    expect(metrics.attendanceRate).toBe(97.5);
  });

  it("averages every counted (student, assignment) score: 3610 / 45", () => {
    expect(metrics.avgScorePct).toBe(80.2);
  });

  it("works out each student's rates", () => {
    expect(of(0)).toEqual({ studentId: "st-0", attendanceRate: 100, avgScorePct: 85, atRisk: false, reasons: [] });
    expect(of(20)).toEqual({ studentId: "st-20", attendanceRate: 100, avgScorePct: 80, atRisk: false, reasons: [] });
    expect(of(27)).toEqual({
      studentId: "st-27",
      attendanceRate: 50,
      avgScorePct: 20,
      atRisk: true,
      reasons: ["attendance", "score"],
    });
    // Late counts as attended; excused is left out of the rate.
    expect(of(28)).toEqual({ studentId: "st-28", attendanceRate: 100, avgScorePct: 80, atRisk: false, reasons: [] });
    expect(of(29)).toEqual({
      studentId: "st-29",
      attendanceRate: 71.4,
      avgScorePct: 0,
      atRisk: true,
      reasons: ["attendance", "score"],
    });
  });

  it("lists the at-risk students", () => {
    expect(metrics.atRiskStudentIds).toEqual(["st-27", "st-29"]);
  });
});

describe("computeClassMetrics: rules", () => {
  it("gives null rates, not zeros, for an empty class", () => {
    expect(computeClassMetrics(input({ students: [], attendances: [], assignments: [], submissions: [] }))).toEqual({
      studentCount: 0,
      sessions: 0,
      attendanceRate: null,
      avgScorePct: null,
      perStudent: [],
      atRiskStudentIds: [],
    });
  });

  it("leaves a student with only excused marks and nothing to score unrated and not at risk", () => {
    const metrics = computeClassMetrics(
      input({
        students: [{ _id: "x" }],
        attendances: [{ studentId: "x", date: "2026-09-07", status: "excused" }],
        assignments: [],
        submissions: [],
      }),
    );

    expect(metrics.perStudent).toEqual([
      { studentId: "x", attendanceRate: null, avgScorePct: null, atRisk: false, reasons: [] },
    ]);
    expect(metrics.attendanceRate).toBeNull();
  });

  it("takes the at-risk thresholds from the class", () => {
    const metrics = computeClassMetrics(input({ cls: { atRiskAttendancePct: 40, atRiskScorePct: 10 } }));

    // st-27: 50 ≥ 40 and 20 ≥ 10. st-29: 71.4 ≥ 40, but a 0 score is still < 10.
    expect(metrics.perStudent[27]?.atRisk).toBe(false);
    expect(metrics.perStudent[29]?.reasons).toEqual(["score"]);
    expect(metrics.atRiskStudentIds).toEqual(["st-29"]);
  });

  it("compares before rounding: 79.99 shows as 80 but is below an 80 threshold", () => {
    const metrics = computeClassMetrics(
      input({
        cls: { atRiskScorePct: 80 },
        students: [{ _id: "x" }],
        attendances: [],
        assignments: [{ _id: "a", maxScore: 10_000, dueDate: "2026-09-10", createdAt: new Date("2026-09-01") }],
        submissions: [{ assignmentId: "a", studentId: "x", status: "approved", score: 7999 }],
      }),
    );

    expect(metrics.perStudent[0]).toMatchObject({ avgScorePct: 80, atRisk: true, reasons: ["score"] });
  });
});

describe("summarizeAttendance", () => {
  it("reports each student's rate, absences and lates in the period", () => {
    const summary = summarizeAttendance(students, attendances, PERIOD.from, PERIOD.to);

    expect(summary[0]).toEqual({ studentId: "st-0", rate: 100, absences: 0, lates: 0 });
    expect(summary[28]).toEqual({ studentId: "st-28", rate: 100, absences: 0, lates: 1 });
    expect(summary[29]).toEqual({ studentId: "st-29", rate: 71.4, absences: 2, lates: 0 });
  });

  it("gives null for a student with no marks", () => {
    expect(summarizeAttendance([{ _id: "new" }], [], PERIOD.from, PERIOD.to)).toEqual([
      { studentId: "new", rate: null, absences: 0, lates: 0 },
    ]);
  });
});
