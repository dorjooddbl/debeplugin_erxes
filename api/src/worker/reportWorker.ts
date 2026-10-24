// Term report summary job: docs/SPEC.md §7.
import type { Job } from "bullmq";
import { createMQWorkerWithListeners, redis } from "erxes-api-shared/utils";
import { generateModels } from "../connectionResolvers.ts";
import { computeClassMetrics } from "../modules/edureport/services/metrics.ts";
import { generateStructured } from "../modules/edureport/services/llm.ts";
import { incrementDone, incrementFailed } from "../modules/edureport/services/progress.ts";
import { generateReportSummary } from "../modules/edureport/services/report.ts";

interface ReportJobData {
  subdomain: string;
  jobId: string;
  reportId: string;
  classId: string;
  from: string;
  to: string;
}

const processReportJob = async (job: Job<ReportJobData>): Promise<void> => {
  const { subdomain, jobId, reportId, classId, from, to } = job.data;
  const today = new Date().toISOString().slice(0, 10);

  let errorMessage = "Unknown error";

  try {
    const models = await generateModels(subdomain);

    const [cls, students, attendances, assignments] = await Promise.all([
      models.Classes.getClass(classId),
      models.Students.listByClass(classId),
      models.Attendances.listByRange(classId, from, to),
      models.Assignments.listByClass(classId),
    ]);

    const submissions = await models.Submissions.find({ classId });

    const metrics = computeClassMetrics({
      cls,
      students,
      attendances,
      assignments,
      submissions,
      from,
      to,
      today,
    });

    await models.Reports.markGenerating(reportId, metrics);

    const { aiSummary, warnings } = await generateReportSummary(cls, metrics, from, to, generateStructured);

    await models.Reports.saveGenerated(reportId, { aiSummary, warnings });
    await incrementDone(jobId, reportId);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);

    const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 3);

    if (isFinalAttempt) {
      try {
        const models = await generateModels(subdomain);

        await models.Reports.markFailed(reportId, errorMessage);
      } catch {
        // Best-effort: don't shadow the original error
      }

      await incrementFailed(jobId, reportId);
    }

    throw error;
  }
};

export const startReportWorker = (): void => {
  createMQWorkerWithListeners(
    "edureport",
    "report",
    processReportJob,
    redis,
    () => {
      console.log("[edureport] Report worker ready");
    },
    { concurrency: 3 },
  );
};
