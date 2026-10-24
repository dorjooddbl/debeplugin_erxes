import { mongooseStringRandomId } from "erxes-api-shared/utils";
import { Schema } from "mongoose";

const criterionSchema = new Schema(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    levels: { type: [String], default: [] },
  },
  { _id: false },
);

export const rubricSchema = new Schema(
  {
    _id: mongooseStringRandomId,
    name: { type: String, required: true },
    teacherId: { type: String, required: true },
    criteria: { type: [criterionSchema], default: [] },
  },
  { collection: "edureport_rubrics", timestamps: true },
);

rubricSchema.index({ teacherId: 1 });
