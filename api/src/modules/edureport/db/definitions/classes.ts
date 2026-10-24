import { mongooseStringRandomId } from "erxes-api-shared/utils";
import { Schema } from "mongoose";

export const classSchema = new Schema(
  {
    _id: mongooseStringRandomId,
    name: { type: String, required: true },
    subject: { type: String, required: true },
    term: { type: String, required: true },
    grade: { type: String },
    teacherId: { type: String, required: true },
    atRiskAttendancePct: { type: Number, min: 0, max: 100 },
    atRiskScorePct: { type: Number, min: 0, max: 100 },
  },
  { collection: "edureport_classes", timestamps: true },
);

classSchema.index({ teacherId: 1 });
