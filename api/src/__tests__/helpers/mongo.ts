import mongoose from "mongoose";
import { type IModels, loadClasses } from "../../connectionResolvers.ts";

// Real-Mongo tests run only when EDUREPORT_TEST_MONGO_URL is set (never
// MONGO_URL: docs/SPEC.md §8). Each suite works in its own throwaway
// database, edureport_jest_<pid>_<time>, and drops only that database.
const url = process.env.EDUREPORT_TEST_MONGO_URL;

export const describeWithMongo = url ? describe : describe.skip;

export const connectTestModels = async () => {
  if (!url) {
    throw new Error("EDUREPORT_TEST_MONGO_URL is not set");
  }

  const base = await mongoose
    .createConnection(url, { serverSelectionTimeoutMS: 30_000 })
    .asPromise();
  const db = base.useDb(`edureport_jest_${process.pid}_${Date.now()}`, { useCache: false });
  const models: IModels = loadClasses(db);

  // Unique indexes must exist before the tests that rely on them.
  await Promise.all(Object.values(models).map((model) => model.init()));

  return {
    models,
    close: async () => {
      await db.dropDatabase();
      await base.close();
    },
  };
};
