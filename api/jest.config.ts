import type { Config } from "jest";

export default {
  displayName: "edureport-api",
  testEnvironment: "node",
  transform: {
    // Transpile-only (tsconfig isolatedModules). Types are enforced by
    // `check` and `build` (tsc), not here.
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json", diagnostics: false }],
  },
  moduleFileExtensions: ["ts", "js", "cjs"],
  moduleNameMapper: {
    // The real bundle opens Redis on import and keeps jest alive.
    "^erxes-api-shared/utils$": "<rootDir>/src/__tests__/helpers/sharedUtils.ts",
  },
  testMatch: ["<rootDir>/src/**/*.test.ts"],
} satisfies Config;
