import { mongooseStringRandomId } from "erxes-api-shared/utils";
import { Schema } from "mongoose";
import { SUBMISSION_STATUSES } from "./enums.ts";

const criterionFeedbackSchema = new Schema(
  {
    criterionKey: { type: String, required: true },
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    evidenceQuote: { type: String },
  },
  { _id: false },
);

const aiDraftSchema = new Schema(
  {
    criteria: { type: [criterionFeedbackSchema], default: [] },
    model: { type: String, required: true },
    generatedAt: { type: Date, required: true },
  },
  { _id: false },
);

export const submissionSchema = new Schema(
  {
    _id: mongooseStringRandomId,
    assignmentId: { type: String, required: true },
    classId: { type: String, required: true },
    studentId: { type: String, required: true },
    text: { type: String },
    aiDraft: { type: aiDraftSchema },
    teacherFeedback: { type: String },
    score: { type: Number },
    status: { type: String, enum: SUBMISSION_STATUSES, required: true },
    error: { type: String },
    queuedAt: { type: Date },
    approvedBy: { type: String },
    approvedAt: { type: Date },
  },
  { collection: "edureport_submissions", timestamps: true },
);

submissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });
// edureportSubmissionList(assignmentId, status?) and feedback queueing.
submissionSchema.index({ assignmentId: 1, status: 1 });
// removeClass and class-wide metrics.
submissionSchema.index({ classId: 1 });
