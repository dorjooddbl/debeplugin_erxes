// Essay feedback job, one submission per job: docs/SPEC.md §7.
import type { Job } from "bullmq";
import { createMQWorkerWithListeners, redis } from "erxes-api-shared/utils";
import { generateModels } from "../connectionResolvers.ts";
import { generateFeedback } from "../modules/edureport/services/feedback.ts";
import { generateStructured } from "../modules/edureport/services/llm.ts";
import { incrementDone, incrementFailed } from "../modules/edureport/services/progress.ts";

interface FeedbackJobData {
  subdomain: string;
  jobId: string;
  submissionId: string;
  assignmentId: string;
  rubricId: string;
  studentCode: string;
}

const processFeedbackJob = async (job: Job<FeedbackJobData>): Promise<void> => {
  const { subdomain, jobId, submissionId, assignmentId, rubricId } = job.data;

  let errorMessage = "Unknown error";

  try {
    const models = await generateModels(subdomain);
    const [submission, assignment, rubric] = await Promise.all([
      models.Submissions.getSubmission(submissionId),
      models.Assignments.getAssignment(assignmentId),
      models.Rubrics.getRubric(rubricId),
    ]);

    const draft = await generateFeedback(submission, assignment, rubric, generateStructured);

    await models.Submissions.saveAiDraft(submissionId, draft);
    await incrementDone(jobId, submissionId);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);

    const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 3);

    if (isFinalAttempt) {
      try {
        const models = await generateModels(subdomain);

        await models.Submissions.markFailed(submissionId, errorMessage);
      } catch {
        // Best-effort: don't shadow the original error
      }

      await incrementFailed(jobId, submissionId);
    }

    throw error;
  }
};

export const startFeedbackWorker = (): void => {
  createMQWorkerWithListeners(
    "edureport",
    "feedback",
    processFeedbackJob,
    redis,
    () => {
      console.log("[edureport] Feedback worker ready");
    },
    { concurrency: 3 },
  );
};
