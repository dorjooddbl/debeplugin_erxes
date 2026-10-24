import { randomUUID } from "node:crypto";
import { GraphQLScalarType } from "graphql";

// Stands in for erxes-api-shared/utils under jest (moduleNameMapper in
// jest.config.ts): the real bundle opens Redis on import. Provide only what
// the code under test imports, with the same shape as the real export.
export class ExpectedError extends Error {
  readonly isExpected = true;
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ExpectedError";
    this.code = code;
  }
}

export const apolloCustomScalars = {
  Date: new GraphQLScalarType({ name: "Date" }),
};

// The real one uses nanoid; any random string id behaves the same here.
export const mongooseStringRandomId = {
  type: String,
  default: () => randomUUID(),
} as const;

// Tests build models with loadClasses on their own connection
// (helpers/mongo.ts); generateModels would connect to MONGO_URL.
export const createGenerateModels =
  <IModels>(_loadClasses: unknown) =>
  async (_subdomain: string): Promise<IModels> => {
    throw new Error("generateModels is not available in tests; use helpers/mongo.ts");
  };
