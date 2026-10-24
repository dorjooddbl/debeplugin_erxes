import type { IContext } from "../../../../../connectionResolvers.ts";
import { assertClassAccess, classScopeFilter } from "../../../services/access.ts";
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
    const filter = { ...(await classScopeFilter(context)), ...(args.term ? { term: args.term } : {}) };

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

  edureportAttendanceSummary: notImplemented("showClasses"),
  edureportRubricList: notImplemented("showClasses"),
  edureportAssignmentList: notImplemented("showClasses"),
  edureportSubmissionList: notImplemented("showClasses"),
  edureportSubmissionDetail: notImplemented("showClasses"),
  edureportReportDetail: notImplemented("showClasses"),
  edureportReportList: notImplemented("showClasses"),
  edureportJobStatus: notImplemented("showClasses"),
};
