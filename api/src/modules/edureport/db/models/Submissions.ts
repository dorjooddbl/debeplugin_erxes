import { ExpectedError } from "erxes-api-shared/utils";
import type { AnyBulkWriteOperation } from "mongoose";
import type { IModels } from "../../../../connectionResolvers.ts";
import type { IAiDraft, ISubmissionDocument, SubmissionStatus } from "../../@types/index.ts";
import { assertScore } from "../../services/validation.ts";
import { submissionSchema } from "../definitions/submissions.ts";

// The status table in docs/SPEC.md §3. Every transition is a conditional
// update on the current status, so concurrent calls cannot skip a state.
const RESUBMITTABLE: SubmissionStatus[] = ["submitted", "failed", "aiDrafted"];
const APPROVABLE: SubmissionStatus[] = ["submitted", "aiDrafted", "failed", "approved"];
// A queued submission older than this is treated as stuck and can be queued again.
const STUCK_AFTER_MS = 30 * 60 * 1000;

const NOT_FOUND = "Илгээсэн ажил олдсонгүй";
const STILL_DRAFTING = "AI ноорог боловсруулагдаж байна";

export const loadSubmissionClass = (models: IModels) => {
  class Submission {
    public static async getSubmission(_id: string) {
      const submission = await models.Submissions.findOne({ _id });

      if (!submission) {
        throw new ExpectedError(NOT_FOUND);
      }

      return submission;
    }

    // New student → submitted. An existing submitted/failed/aiDrafted one gets
    // the new text and loses its draft and error; queued and approved ones are
    // left alone and not counted.
    public static async bulkAdd(
      assignmentId: string,
      classId: string,
      items: { studentId: string; text: string }[],
    ) {
      if (!items.length) {
        return 0;
      }

      const existing = await models.Submissions.find(
        { assignmentId, studentId: { $in: items.map(({ studentId }) => studentId) } },
        { studentId: 1, status: 1 },
      );
      const statusOf = new Map(existing.map(({ studentId, status }) => [studentId, status]));

      const ops: AnyBulkWriteOperation<ISubmissionDocument>[] = [];

      for (const { studentId, text } of items) {
        const status = statusOf.get(studentId);

        if (!status) {
          ops.push({
            updateOne: {
              filter: { assignmentId, studentId },
              update: { $setOnInsert: { classId, text, status: "submitted" } },
              upsert: true,
            },
          });
        } else if (RESUBMITTABLE.includes(status)) {
          ops.push({
            updateOne: {
              filter: { assignmentId, studentId, status: { $in: RESUBMITTABLE } },
              update: { $set: { text, status: "submitted" }, $unset: { aiDraft: 1, error: 1 } },
            },
          });
        }
      }

      if (!ops.length) {
        return 0;
      }

      const result = await models.Submissions.bulkWrite(ops);

      return result.upsertedCount + result.modifiedCount;
    }

    // submitted/failed/aiDrafted, or queued for longer than STUCK_AFTER_MS →
    // queued. Returns only the ids this call moved.
    public static async markQueued(ids: string[]) {
      const stuckBefore = new Date(Date.now() - STUCK_AFTER_MS);

      const moved = await Promise.all(
        [...new Set(ids)].map(async (_id) => {
          const result = await models.Submissions.updateOne(
            {
              _id,
              $or: [
                { status: { $in: RESUBMITTABLE } },
                { status: "queued", queuedAt: { $not: { $gte: stuckBefore } } },
              ],
            },
            { $set: { status: "queued", queuedAt: new Date() } },
          );

          return result.modifiedCount ? _id : null;
        }),
      );

      return moved.filter((_id): _id is string => _id !== null);
    }

    // queued → aiDrafted only. A submission that left `queued` meanwhile (for
    // example re-submitted text) keeps its state and the draft is dropped.
    public static async saveAiDraft(_id: string, draft: IAiDraft) {
      await models.Submissions.updateOne(
        { _id, status: "queued" },
        { $set: { aiDraft: draft, status: "aiDrafted" }, $unset: { error: 1 } },
      );
    }

    // queued → failed only.
    public static async markFailed(_id: string, error: string) {
      await models.Submissions.updateOne(
        { _id, status: "queued" },
        { $set: { status: "failed", error } },
      );
    }

    // Essays only, never while the AI draft is being written.
    public static async approve(
      _id: string,
      { teacherFeedback, score, approvedBy }: { teacherFeedback: string; score: number; approvedBy: string },
    ) {
      const submission = await models.Submissions.getSubmission(_id);
      const assignment = await models.Assignments.getAssignment(submission.assignmentId);

      if (assignment.kind !== "essay") {
        throw new ExpectedError("Зөвхөн эссэ даалгаврыг батална");
      }

      assertScore(score, assignment.maxScore);

      if (submission.status === "queued") {
        throw new ExpectedError(STILL_DRAFTING);
      }

      const approved = await models.Submissions.findOneAndUpdate(
        { _id, status: { $in: APPROVABLE } },
        {
          $set: { teacherFeedback, score, approvedBy, approvedAt: new Date(), status: "approved" },
        },
        { new: true },
      );

      if (!approved) {
        // Queued between the read and the write.
        throw new ExpectedError(STILL_DRAFTING);
      }

      return approved;
    }

    // Task assignments only: upserts approved scores. A student whose
    // submission exists but is not approved is skipped and not counted.
    public static async setScores(
      assignmentId: string,
      classId: string,
      entries: { studentId: string; score: number }[],
      approvedBy: string,
    ) {
      const assignment = await models.Assignments.getAssignment(assignmentId);

      if (assignment.classId !== classId) {
        throw new ExpectedError("Даалгавар олдсонгүй");
      }

      if (assignment.kind !== "task") {
        throw new ExpectedError("Оноог зөвхөн энгийн даалгаварт шивнэ");
      }

      for (const { score } of entries) {
        assertScore(score, assignment.maxScore);
      }

      if (!entries.length) {
        return 0;
      }

      const notApproved = await models.Submissions.find(
        {
          assignmentId,
          studentId: { $in: entries.map(({ studentId }) => studentId) },
          status: { $ne: "approved" },
        },
        { studentId: 1 },
      );
      const skipped = new Set(notApproved.map(({ studentId }) => studentId));
      const approvedAt = new Date();

      const ops: AnyBulkWriteOperation<ISubmissionDocument>[] = entries
        .filter(({ studentId }) => !skipped.has(studentId))
        .map(({ studentId, score }) => ({
          updateOne: {
            filter: { assignmentId, studentId },
            update: {
              $set: { score, status: "approved", approvedBy, approvedAt },
              $setOnInsert: { classId },
            },
            upsert: true,
          },
        }));

      if (!ops.length) {
        return 0;
      }

      const result = await models.Submissions.bulkWrite(ops);

      return result.upsertedCount + result.matchedCount;
    }
  }

  submissionSchema.loadClass(Submission);

  return submissionSchema;
};
