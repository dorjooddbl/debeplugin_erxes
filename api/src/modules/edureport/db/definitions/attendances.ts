import { mongooseStringRandomId } from "erxes-api-shared/utils";
import { Schema } from "mongoose";
import { ATTENDANCE_STATUSES } from "./enums.ts";

export const attendanceSchema = new Schema(
  {
    _id: mongooseStringRandomId,
    classId: { type: String, required: true },
    studentId: { type: String, required: true },
    date: { type: String, required: true },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    markedBy: { type: String, required: true },
  },
  { collection: "edureport_attendances", timestamps: true },
);

attendanceSchema.index({ classId: 1, studentId: 1, date: 1 }, { unique: true });
// listByRange: one class over a date range.
attendanceSchema.index({ classId: 1, date: 1 });
