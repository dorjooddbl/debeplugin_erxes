import { createOpenAI } from "@ai-sdk/openai";
import { Output, generateText } from "ai";
import { ExpectedError } from "erxes-api-shared/utils";
import type { z } from "zod";

// LLM client and env: docs/SPEC.md §7. OpenAI through the AI SDK, structured
// output validated by Zod. Without a key the AI operations fail with a clear
// error; the plugin itself keeps running.

const DEFAULT_MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 30_000;

export const llmModelName = () => process.env.EDUREPORT_LLM_MODEL || DEFAULT_MODEL;

export const assertLlmConfigured = (): void => {
  if (!process.env.EDUREPORT_OPENAI_API_KEY) {
    throw new ExpectedError("AI тохируулагдаагүй байна: EDUREPORT_OPENAI_API_KEY алга");
  }
};

export type GenerateStructured = <T>(schema: z.ZodType<T>, system: string, prompt: string) => Promise<T>;

// One call, 30 s at most. Retries belong to the BullMQ job (SPEC §7), so the
// SDK's own retries are off.
export const generateStructured: GenerateStructured = async (schema, system, prompt) => {
  assertLlmConfigured();

  const openai = createOpenAI({ apiKey: process.env.EDUREPORT_OPENAI_API_KEY });

  const { output } = await generateText({
    model: openai(llmModelName()),
    system,
    prompt,
    output: Output.object({ schema }),
    timeout: TIMEOUT_MS,
    maxRetries: 0,
  });

  return output;
};
