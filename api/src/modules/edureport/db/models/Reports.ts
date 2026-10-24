import { ExpectedError } from "erxes-api-shared/utils";
import type { IModels } from "../../../../connectionResolvers.ts";
import type { IReportMetrics } from "../../@types/index.ts";
import { reportSchema } from "../definitions/reports.ts";

// The report status table in docs/SPEC.md §3. Worker-side transitions
// (saveGenerated, markFailed) are no-ops outside their start states so a
// retried job cannot overwrite a finished report.
export const loadReportClass = (models: IModels) => {
  class Report {
    public static async getReport(_id: string) {
      const report = await models.Reports.findOne({ _id });

      if (!report) {
        throw new ExpectedError("Тайлан олдсонгүй");
      }

      return report;
    }

    public static async createDraft(classId: string, from: string, to: string, createdBy: string) {
      return models.Reports.create({
        classId,
        periodFrom: from,
        periodTo: to,
        createdBy,
        status: "draft",
      });
    }

    // draft → generating, with the metrics the report is written from.
    public static async markGenerating(_id: string, metrics: IReportMetrics) {
      const result = await models.Reports.updateOne(
        { _id, status: "draft" },
        { $set: { status: "generating", metrics } },
      );

      if (!result.matchedCount) {
        await models.Reports.getReport(_id);

        throw new ExpectedError("Тайлан ноорог төлөвт биш байна");
      }
    }

    // generating → ready.
    public static async saveGenerated(_id: string, { aiSummary, warnings }: { aiSummary: string; warnings: string[] }) {
      await models.Reports.updateOne(
        { _id, status: "generating" },
        { $set: { status: "ready", aiSummary, warnings }, $unset: { error: 1 } },
      );
    }

    // draft or generating → failed.
    public static async markFailed(_id: string, error: string) {
      await models.Reports.updateOne(
        { _id, status: { $in: ["draft", "generating"] } },
        { $set: { status: "failed", error } },
      );
    }

    // ready only; an approved report is never edited.
    public static async updateText(_id: string, teacherText: string) {
      const report = await models.Reports.findOneAndUpdate(
        { _id, status: "ready" },
        { $set: { teacherText } },
        { new: true },
      );

      if (!report) {
        const current = await models.Reports.getReport(_id);

        throw new ExpectedError(
          current.status === "approved" ? "Батлагдсан тайланг засахгүй" : "Тайлан бэлэн болоогүй байна",
        );
      }

      return report;
    }

    // ready → approved. An empty teacherText takes the AI summary.
    public static async approve(_id: string, approvedBy: string) {
      const report = await models.Reports.getReport(_id);

      if (report.status !== "ready") {
        throw new ExpectedError(
          report.status === "approved" ? "Тайлан аль хэдийн батлагдсан" : "Зөвхөн бэлэн тайланг батална",
        );
      }

      const teacherText = report.teacherText?.trim() ? report.teacherText : report.aiSummary;

      const approved = await models.Reports.findOneAndUpdate(
        { _id, status: "ready" },
        { $set: { status: "approved", approvedBy, approvedAt: new Date(), teacherText } },
        { new: true },
      );

      if (!approved) {
        throw new ExpectedError("Тайлан аль хэдийн батлагдсан");
      }

      return approved;
    }
  }

  reportSchema.loadClass(Report);

  return reportSchema;
};
