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
import { makeJobId, initProgress } from "../../../services/progress.ts";
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
import { feedbackQueue, reportQueue } from "../../../../../worker/index.ts";

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

  async edureportFeedbackGenerate(
    _root: unknown,
    {
      assignmentId,
      submissionIds,
    }: { assignmentId: string; submissionIds?: string[] | null },
    context: IContext,
  ) {
    await context.checkPermission("feedbackGenerate");

    const assignment = await assertAssignmentAccess(context.models, context, assignmentId);

    if (assignment.kind !== "essay") {
      throw new ExpectedError("Зөвхөн эссэ даалгаварт AI санал хүсэлт үүсгэж болно");
    }

    if (!assignment.rubricId) {
      throw new ExpectedError("Эссэ даалгавар rubric-гүй байна");
    }

    const rubric = await context.models.Rubrics.getRubric(assignment.rubricId);

    // Determine which submissions to queue.
    let eligibleIds: string[];

    if (submissionIds && submissionIds.length > 0) {
      // Filter to only those that are in a queueable state.
      const stuckBefore = new Date(Date.now() - 30 * 60 * 1000);
      const subs = await context.models.Submissions.find({
        _id: { $in: submissionIds },
        assignmentId,
        $or: [
          { status: { $in: ["submitted", "failed", "aiDrafted"] } },
          { status: "queued", queuedAt: { $not: { $gte: stuckBefore } } },
        ],
      });

      eligibleIds = subs.map((s) => s._id);
    } else {
      // Get all submitted/failed/aiDrafted/stuck-queued submissions.
      const stuckBefore = new Date(Date.now() - 30 * 60 * 1000);
      const subs = await context.models.Submissions.find({
        assignmentId,
        $or: [
          { status: { $in: ["submitted", "failed", "aiDrafted"] } },
          { status: "queued", queuedAt: { $not: { $gte: stuckBefore } } },
        ],
      });

      eligibleIds = subs.map((s) => s._id);
    }

    if (!eligibleIds.length) {
      return { jobId: "", queued: 0 };
    }

    const queuedIds = await context.models.Submissions.markQueued(eligibleIds);

    if (!queuedIds.length) {
      return { jobId: "", queued: 0 };
    }

    const jobId = makeJobId(context.subdomain, "feedback");

    await initProgress(jobId, assignment.classId, queuedIds.length);

    // Fetch student codes for each queued submission.
    const submissionDocs = await context.models.Submissions.find({ _id: { $in: queuedIds } });
    const studentIds = submissionDocs.map((s) => s.studentId);
    const studentDocs = await context.models.Students.find({ _id: { $in: studentIds }, classId: assignment.classId });
    const codeById = new Map(studentDocs.map((s) => [s._id, s.code]));

    for (const sub of submissionDocs) {
      const studentCode = codeById.get(sub.studentId) ?? sub.studentId;

      await feedbackQueue.add("feedback", {
        subdomain: context.subdomain,
        jobId,
        submissionId: sub._id,
        assignmentId,
        rubricId: rubric._id,
        studentCode,
      }, { attempts: 3, backoff: { type: "exponential", delay: 5000 } });
    }

    return { jobId, queued: queuedIds.length };
  },

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
  async edureportReportGenerate(
    _root: unknown,
    { classId, from, to }: { classId: string; from: string; to: string },
    context: IContext,
  ) {
    await context.checkPermission("reportsManage");
    await assertClassAccess(context.models, context, classId);

    assertDate(from);
    assertDate(to);

    if (from > to) {
      throw new ExpectedError("Эхлэх огноо дуусах огнооноос хойш байна");
    }

    const report = await context.models.Reports.createDraft(classId, from, to, context.user._id);
    const jobId = makeJobId(context.subdomain, "report");

    await initProgress(jobId, classId, 1);
    await reportQueue.add("report", {
      subdomain: context.subdomain,
      jobId,
      reportId: report._id,
      classId,
      from,
      to,
    }, { attempts: 3, backoff: { type: "exponential", delay: 5000 } });

    return { reportId: report._id, jobId };
  },

  async edureportReportEdit(
    _root: unknown,
    { _id, teacherText }: { _id: string; teacherText: string },
    context: IContext,
  ) {
    await context.checkPermission("reportsManage");

    const report = await context.models.Reports.getReport(_id);

    await assertClassAccess(context.models, context, report.classId);
    assertFilled(teacherText, "Тайлангийн текст");

    return context.models.Reports.updateText(_id, teacherText);
  },

  async edureportReportApprove(
    _root: unknown,
    { _id }: { _id: string },
    context: IContext,
  ) {
    await context.checkPermission("reportsApprove");

    const report = await context.models.Reports.getReport(_id);

    await assertClassAccess(context.models, context, report.classId);

    return context.models.Reports.approve(_id, context.user._id);
  },
};
