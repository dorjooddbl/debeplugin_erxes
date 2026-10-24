// BullMQ queues edureport-feedback and edureport-report: docs/SPEC.md §7.
import { Queue } from "bullmq";
import { DEFAULT_JOB_OPTIONS } from "erxes-api-shared/utils";
import { redisConnection } from "../config.ts";

export const feedbackQueue = new Queue("edureport-feedback", {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

export const reportQueue = new Queue("edureport-report", {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});
