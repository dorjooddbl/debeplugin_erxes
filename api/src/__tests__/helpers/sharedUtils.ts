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
