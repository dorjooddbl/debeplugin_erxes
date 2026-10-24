import mongoose from "mongoose";
import { type IModels, loadClasses } from "../../connectionResolvers.ts";

// Real-Mongo tests run only when EDUREPORT_TEST_MONGO_URL is set (never
// MONGO_URL: docs/SPEC.md §8). Each suite works in its own throwaway
// database, edureport_jest_<pid>_<time>, and removes only that database.
const url = process.env.EDUREPORT_TEST_MONGO_URL;

const isMissingCollection = (error: unknown) =>
  typeof error === "object" && error !== null && "codeName" in error && error.codeName === "NamespaceNotFound";

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
    // A readWrite user (the Atlas test user) may not dropDatabase, but may
    // drop collections; once the last one goes, so does the database.
    close: async () => {
      await Promise.all(
        Object.values(models).map((model) =>
          model.collection.drop().catch((error: unknown) => {
            if (!isMissingCollection(error)) {
              throw error;
            }
          }),
        ),
      );
      await base.close();
    },
  };
};
