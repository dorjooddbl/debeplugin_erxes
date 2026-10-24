import { ExpectedError } from "erxes-api-shared/utils";
import type { IContext } from "../../../../connectionResolvers.ts";

// Placeholder for an operation whose body lands in a later step
// (docs/PROMPTS.md). It still checks the SPEC §5 permission first, so the
// schema is safe to expose before the implementation exists.
export const notImplemented =
  (action: string) =>
  async (_root: unknown, _args: unknown, { checkPermission }: IContext): Promise<never> => {
    await checkPermission(action);

    throw new ExpectedError("Хэрэгжээгүй байна");
  };
