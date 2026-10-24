import { mongooseStringRandomId } from "erxes-api-shared/utils";
import { Schema } from "mongoose";
import { REPORT_STATUSES, RISK_REASONS } from "./enums.ts";

const studentMetricSchema = new Schema(
  {
    studentId: { type: String, required: true },
    attendanceRate: { type: Number, default: null },
    avgScorePct: { type: Number, default: null },
    atRisk: { type: Boolean, required: true },
    reasons: { type: [{ type: String, enum: RISK_REASONS }], default: [] },
  },
  { _id: false },
);

const metricsSchema = new Schema(
  {
    studentCount: { type: Number, required: true },
    sessions: { type: Number, required: true },
    attendanceRate: { type: Number, default: null },
    avgScorePct: { type: Number, default: null },
    perStudent: { type: [studentMetricSchema], default: [] },
    atRiskStudentIds: { type: [String], default: [] },
  },
  { _id: false },
);

export const reportSchema = new Schema(
  {
    _id: mongooseStringRandomId,
    classId: { type: String, required: true },
    periodFrom: { type: String, required: true },
    periodTo: { type: String, required: true },
    createdBy: { type: String, required: true },
    status: { type: String, enum: REPORT_STATUSES, required: true },
    metrics: { type: metricsSchema },
    aiSummary: { type: String },
    warnings: { type: [String], default: undefined },
    teacherText: { type: String },
    error: { type: String },
    approvedBy: { type: String },
    approvedAt: { type: Date },
  },
  { collection: "edureport_reports", timestamps: true },
);

reportSchema.index({ classId: 1 });
