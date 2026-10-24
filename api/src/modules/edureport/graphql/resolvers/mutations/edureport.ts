import type { IContext } from "../../../../../connectionResolvers.ts";
import type { AttendanceStatus, IClass } from "../../../@types/index.ts";
import { assertClassAccess, assertStudentsInClass } from "../../../services/access.ts";
import {
  MAX_ENTRIES,
  MAX_ROWS,
  assertDate,
  assertMaxItems,
  assertPercent,
  parseStudentRows,
} from "../../../services/validation.ts";
import { notImplemented } from "../notImplemented.ts";

type ClassEditArgs = { _id: string } & {
  [K in keyof Omit<IClass, "teacherId">]?: IClass[K] | null;
};

// Permission per operation: docs/SPEC.md §5. Each resolver checks it first.
export const edureportMutations = {
  async edureportClassAdd(
    _root: unknown,
    { name, subject, term, grade }: { name: string; subject: string; term: string; grade?: string | null },
    context: IContext,
  ) {
    await context.checkPermission("classesManage");

    return context.models.Classes.createClass({
      name,
      subject,
      term,
      ...(grade ? { grade } : {}),
      teacherId: context.user._id,
    });
  },

  async edureportClassEdit(_root: unknown, { _id, ...fields }: ClassEditArgs, context: IContext) {
    await context.checkPermission("classesManage");
    await assertClassAccess(context.models, context, _id);

    assertPercent(fields.atRiskAttendancePct, "Ирцийн босго");
    assertPercent(fields.atRiskScorePct, "Онооны босго");

    // Only fields the client sent; null leaves a field as it is.
    const doc = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined && value !== null),
    ) as Partial<Omit<IClass, "teacherId">>;

    return context.models.Classes.updateClass(_id, doc);
  },

  async edureportClassRemove(_root: unknown, { _id }: { _id: string }, context: IContext) {
    await context.checkPermission("classesManage");
    await assertClassAccess(context.models, context, _id);
    await context.models.Classes.removeClass(_id);

    return true;
  },

  async edureportStudentsImport(
    _root: unknown,
    { classId, rows }: { classId: string; rows: { name: string; code: string }[] },
    context: IContext,
  ) {
    await context.checkPermission("classesManage");
    await assertClassAccess(context.models, context, classId);
    assertMaxItems(rows, MAX_ROWS);

    const { valid, errors } = parseStudentRows(rows);
    const { inserted, skippedCodes } = await context.models.Students.bulkInsertStudents(classId, valid);

    return { inserted, skippedCodes, errors };
  },

  async edureportAttendanceMark(
    _root: unknown,
    {
      classId,
      date,
      entries,
    }: { classId: string; date: string; entries: { studentId: string; status: AttendanceStatus }[] },
    context: IContext,
  ) {
    await context.checkPermission("attendanceMark");
    await assertClassAccess(context.models, context, classId);
    assertDate(date);
    assertMaxItems(entries, MAX_ENTRIES);
    await assertStudentsInClass(
      context.models,
      classId,
      entries.map(({ studentId }) => studentId),
    );

    return context.models.Attendances.bulkMark(classId, date, entries, context.user._id);
  },

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
