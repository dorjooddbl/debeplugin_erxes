import { ExpectedError } from "erxes-api-shared/utils";
import type { IContext } from "../../../../../connectionResolvers.ts";
import type { AssignmentKind, AttendanceStatus, IClass, IRubricCriterion } from "../../../@types/index.ts";
import {
  assertAssignmentAccess,
  assertClassAccess,
  assertOwnRubric,
  assertStudentsInClass,
  assertSubmissionAccess,
} from "../../../services/access.ts";
import {
  MAX_ENTRIES,
  MAX_ITEMS,
  MAX_ROWS,
  assertDate,
  assertEssayTexts,
  assertFilled,
  assertMaxItems,
  assertMaxScore,
  assertPercent,
  assertRubricCriteria,
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

  // A new rubric, or the user's own existing one; it always belongs to the user.
  async edureportRubricSave(
    _root: unknown,
    { _id, name, criteria }: { _id?: string | null; name: string; criteria: IRubricCriterion[] },
    context: IContext,
  ) {
    await context.checkPermission("assignmentsManage");

    if (_id) {
      await assertOwnRubric(context.models, context, _id);
    }

    assertFilled(name, "Шалгуурын нэр");
    assertRubricCriteria(criteria);

    return context.models.Rubrics.saveRubric(_id ?? undefined, {
      name,
      criteria,
      teacherId: context.user._id,
    });
  },

  async edureportAssignmentAdd(
    _root: unknown,
    {
      classId,
      title,
      kind,
      maxScore,
      rubricId,
      dueDate,
    }: {
      classId: string;
      title: string;
      kind: AssignmentKind;
      maxScore: number;
      rubricId?: string | null;
      dueDate?: string | null;
    },
    context: IContext,
  ) {
    await context.checkPermission("assignmentsManage");
    await assertClassAccess(context.models, context, classId);

    assertFilled(title, "Гарчиг");
    assertMaxScore(maxScore);

    if (dueDate) {
      assertDate(dueDate);
    }

    if (kind === "essay" && !rubricId) {
      throw new ExpectedError("Эссэ даалгаварт шалгуур заавал сонгоно");
    }

    if (rubricId) {
      await assertOwnRubric(context.models, context, rubricId);
    }

    return context.models.Assignments.createAssignment({
      classId,
      title,
      kind,
      maxScore,
      ...(rubricId ? { rubricId } : {}),
      ...(dueDate ? { dueDate } : {}),
    });
  },

  // Task scores; the model rejects essays and out-of-range scores.
  async edureportScoresSet(
    _root: unknown,
    { assignmentId, entries }: { assignmentId: string; entries: { studentId: string; score: number }[] },
    context: IContext,
  ) {
    await context.checkPermission("submissionsApprove");

    const assignment = await assertAssignmentAccess(context.models, context, assignmentId);

    assertMaxItems(entries, MAX_ENTRIES);
    await assertStudentsInClass(
      context.models,
      assignment.classId,
      entries.map(({ studentId }) => studentId),
    );

    return context.models.Submissions.setScores(assignmentId, assignment.classId, entries, context.user._id);
  },

  // Essay texts only: a text submission on a task would keep setScores from
  // scoring that student. Never carries a score.
  async edureportSubmissionsAdd(
    _root: unknown,
    { assignmentId, items }: { assignmentId: string; items: { studentId: string; text: string }[] },
    context: IContext,
  ) {
    await context.checkPermission("assignmentsManage");

    const assignment = await assertAssignmentAccess(context.models, context, assignmentId);

    if (assignment.kind !== "essay") {
      throw new ExpectedError("Эссэг зөвхөн эссэ даалгаварт оруулна");
    }

    assertMaxItems(items, MAX_ITEMS);
    assertEssayTexts(items);
    await assertStudentsInClass(
      context.models,
      assignment.classId,
      items.map(({ studentId }) => studentId),
    );

    return context.models.Submissions.bulkAdd(
      assignmentId,
      assignment.classId,
      items.map(({ studentId, text }) => ({ studentId, text })),
    );
  },

  edureportFeedbackGenerate: notImplemented("feedbackGenerate"),

  // The model allows essays only, not while queued, and 0 ≤ score ≤ maxScore.
  async edureportSubmissionApprove(
    _root: unknown,
    { _id, teacherFeedback, score }: { _id: string; teacherFeedback: string; score: number },
    context: IContext,
  ) {
    await context.checkPermission("submissionsApprove");
    await assertSubmissionAccess(context.models, context, _id);

    assertFilled(teacherFeedback, "Багшийн санал хүсэлт");

    return context.models.Submissions.approve(_id, {
      teacherFeedback,
      score,
      approvedBy: context.user._id,
    });
  },
  edureportReportGenerate: notImplemented("reportsManage"),
  edureportReportEdit: notImplemented("reportsManage"),
  edureportReportApprove: notImplemented("reportsApprove"),
};
