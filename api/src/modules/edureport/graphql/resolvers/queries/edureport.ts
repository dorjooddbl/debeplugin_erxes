import type { IContext } from "../../../../../connectionResolvers.ts";
import type { SubmissionStatus } from "../../../@types/index.ts";
import {
  assertAssignmentAccess,
  assertClassAccess,
  assertSubmissionAccess,
  teacherScopeFilter,
} from "../../../services/access.ts";
import { summarizeAttendance } from "../../../services/metrics.ts";
import { assertDateRange, parsePage } from "../../../services/validation.ts";
import { notImplemented } from "../notImplemented.ts";

// Permission per operation: docs/SPEC.md §5. Each resolver checks it first.
export const edureportQueries = {
  async edureportClassList(
    _root: unknown,
    args: { term?: string | null; page?: number | null; perPage?: number | null },
    context: IContext,
  ) {
    await context.checkPermission("showClasses");

    const { skip, limit } = parsePage(args);
    const filter = { ...(await teacherScopeFilter(context)), ...(args.term ? { term: args.term } : {}) };

    const [list, totalCount] = await Promise.all([
      context.models.Classes.find(filter).sort({ createdAt: -1, _id: 1 }).skip(skip).limit(limit),
      context.models.Classes.countDocuments(filter),
    ]);

    return { list, totalCount };
  },

  async edureportClassDetail(_root: unknown, { _id }: { _id: string }, context: IContext) {
    await context.checkPermission("showClasses");

    return assertClassAccess(context.models, context, _id);
  },

  async edureportStudentList(_root: unknown, { classId }: { classId: string }, context: IContext) {
    await context.checkPermission("showClasses");
    await assertClassAccess(context.models, context, classId);

    return context.models.Students.listByClass(classId);
  },

  async edureportAttendanceList(
    _root: unknown,
    { classId, from, to }: { classId: string; from: string; to: string },
    context: IContext,
  ) {
    await context.checkPermission("showClasses");
    await assertClassAccess(context.models, context, classId);
    assertDateRange(from, to);

    return context.models.Attendances.listByRange(classId, from, to);
  },

  async edureportAttendanceSummary(
    _root: unknown,
    { classId, from, to }: { classId: string; from: string; to: string },
    context: IContext,
  ) {
    await context.checkPermission("showClasses");
    await assertClassAccess(context.models, context, classId);
    assertDateRange(from, to);

    const [students, attendances] = await Promise.all([
      context.models.Students.listByClass(classId),
      context.models.Attendances.listByRange(classId, from, to),
    ]);

    return summarizeAttendance(students, attendances, from, to);
  },

  // The user's own rubrics; owners and classesViewAll see every teacher's.
  async edureportRubricList(_root: unknown, _args: unknown, context: IContext) {
    await context.checkPermission("showClasses");

    return context.models.Rubrics.find(await teacherScopeFilter(context)).sort({ createdAt: -1, _id: 1 });
  },

  async edureportAssignmentList(_root: unknown, { classId }: { classId: string }, context: IContext) {
    await context.checkPermission("showClasses");
    await assertClassAccess(context.models, context, classId);

    return context.models.Assignments.listByClass(classId);
  },

  async edureportSubmissionList(
    _root: unknown,
    { assignmentId, status }: { assignmentId: string; status?: SubmissionStatus | null },
    context: IContext,
  ) {
    await context.checkPermission("showClasses");
    await assertAssignmentAccess(context.models, context, assignmentId);

    return context.models.Submissions.find({ assignmentId, ...(status ? { status } : {}) }).sort({
      createdAt: 1,
      _id: 1,
    });
  },

  async edureportSubmissionDetail(_root: unknown, { _id }: { _id: string }, context: IContext) {
    await context.checkPermission("showClasses");

    return assertSubmissionAccess(context.models, context, _id);
  },

  edureportReportDetail: notImplemented("showClasses"),
  edureportReportList: notImplemented("showClasses"),
  edureportJobStatus: notImplemented("showClasses"),
};
