// Job progress hash and publish: docs/SPEC.md §7.
import { graphqlPubsub, redis } from "erxes-api-shared/utils";
import { randomAlphanumeric } from "erxes-api-shared/utils";

const PROGRESS_TTL = 24 * 60 * 60; // 24 hours in seconds
const HASH_PREFIX = "edureportProgress:";
const CHANNEL_PREFIX = "edureportJobProgress:";

export const makeJobId = (subdomain: string, type: "feedback" | "report"): string =>
  `${subdomain}:${type}:${randomAlphanumeric(12)}`;

export const initProgress = async (jobId: string, classId: string, total: number): Promise<void> => {
  const key = `${HASH_PREFIX}${jobId}`;

  await redis.hset(key, { total: String(total), done: "0", failed: "0", classId });
  await redis.expire(key, PROGRESS_TTL);

  await publish(jobId, { total, done: 0, failed: 0, finished: total === 0, lastId: undefined });
};

const publish = async (
  jobId: string,
  payload: { total: number; done: number; failed: number; finished: boolean; lastId: string | undefined },
): Promise<void> => {
  await graphqlPubsub.publish(`${CHANNEL_PREFIX}${jobId}`, {
    edureportJobProgress: {
      total: payload.total,
      done: payload.done,
      failed: payload.failed,
      finished: payload.finished,
      lastId: payload.lastId,
    },
  });
};

export const incrementDone = async (jobId: string, lastId?: string): Promise<void> => {
  const key = `${HASH_PREFIX}${jobId}`;

  const done = await redis.hincrby(key, "done", 1);
  const [totalStr, failedStr] = await redis.hmget(key, "total", "failed");
  const total = Number(totalStr ?? 0);
  const failed = Number(failedStr ?? 0);

  await publish(jobId, { total, done, failed, finished: done + failed >= total, lastId });
};

export const incrementFailed = async (jobId: string, lastId?: string): Promise<void> => {
  const key = `${HASH_PREFIX}${jobId}`;

  const failed = await redis.hincrby(key, "failed", 1);
  const [totalStr, doneStr] = await redis.hmget(key, "total", "done");
  const total = Number(totalStr ?? 0);
  const done = Number(doneStr ?? 0);

  await publish(jobId, { total, done, failed, finished: done + failed >= total, lastId });
};

export const getProgress = async (
  jobId: string,
): Promise<{ total: number; done: number; failed: number; classId: string; finished: boolean } | null> => {
  const key = `${HASH_PREFIX}${jobId}`;
  const data = await redis.hgetall(key);

  if (!data || !data.total) {
    return null;
  }

  const total = Number(data.total);
  const done = Number(data.done ?? 0);
  const failed = Number(data.failed ?? 0);

  return {
    total,
    done,
    failed,
    classId: data.classId ?? "",
    finished: done + failed >= total,
  };
};
