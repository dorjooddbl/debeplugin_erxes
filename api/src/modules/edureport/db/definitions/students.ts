import { mongooseStringRandomId } from "erxes-api-shared/utils";
import { Schema } from "mongoose";

export const studentSchema = new Schema(
  {
    _id: mongooseStringRandomId,
    classId: { type: String, required: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    customerId: { type: String },
  },
  { collection: "edureport_students", timestamps: true },
);

// Also serves lookups by classId.
studentSchema.index({ classId: 1, code: 1 }, { unique: true });
