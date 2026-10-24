import { mongooseStringRandomId } from "erxes-api-shared/utils";
import { Schema } from "mongoose";
import { ASSIGNMENT_KINDS } from "./enums.ts";

export const assignmentSchema = new Schema(
  {
    _id: mongooseStringRandomId,
    classId: { type: String, required: true },
    title: { type: String, required: true },
    kind: { type: String, enum: ASSIGNMENT_KINDS, required: true },
    maxScore: { type: Number, required: true },
    rubricId: { type: String },
    dueDate: { type: String },
  },
  { collection: "edureport_assignments", timestamps: true },
);

assignmentSchema.index({ classId: 1 });
