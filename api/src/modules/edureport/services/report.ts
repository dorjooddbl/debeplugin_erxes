// Report generation: docs/SPEC.md §6, §7.
import { z } from "zod";
import type { IClassDocument, IReportMetrics } from "../@types/index.ts";
import { checkReportNumbers } from "./guards.ts";
import type { GenerateStructured } from "./llm.ts";
import { reportPrompt } from "./prompts.ts";

const reportOutputSchema = z.object({
  aiSummary: z.string(),
});

export const generateReportSummary = async (
  cls: IClassDocument,
  metrics: IReportMetrics,
  from: string,
  to: string,
  generate: GenerateStructured,
): Promise<{ aiSummary: string; warnings: string[] }> => {
  const { system, user } = reportPrompt(cls, metrics, from, to);
  const output = await generate(reportOutputSchema, system, user);
  const { aiSummary } = output;
  const warnings = checkReportNumbers(aiSummary, metrics, cls, from, to);

  return { aiSummary, warnings };
};
