// Essay feedback generation: docs/SPEC.md §7.
import { z } from "zod";
import type { IAssignmentDocument, IAiDraft, IRubricDocument, ISubmissionDocument } from "../@types/index.ts";
import { containsGradeHint, stripInvalidQuotes } from "./guards.ts";
import type { GenerateStructured } from "./llm.ts";
import { llmModelName } from "./llm.ts";
import { feedbackPrompt } from "./prompts.ts";

// Zod schema for structured feedback output — no score or grade fields.
const criterionFeedbackSchema = z.object({
  criterionKey: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  evidenceQuote: z.string().optional(),
});

const feedbackOutputSchema = z.object({
  criteria: z.array(criterionFeedbackSchema),
});

export const generateFeedback = async (
  submission: ISubmissionDocument,
  assignment: IAssignmentDocument,
  rubric: IRubricDocument,
  generate: GenerateStructured,
): Promise<IAiDraft> => {
  const essayText = submission.text ?? "";
  const studentCode = String(submission.studentId);

  const { system, user } = feedbackPrompt(assignment, rubric, essayText, studentCode);

  const attempt = async (): Promise<IAiDraft> => {
    const output = await generate(feedbackOutputSchema, system, user);
    const cleaned = stripInvalidQuotes(output.criteria, essayText);

    return {
      criteria: cleaned,
      model: llmModelName(),
      generatedAt: new Date(),
    };
  };

  let draft = await attempt();

  // Collect all strengths and improvements (not evidenceQuote) to check for grade hints.
  const extractTexts = (d: IAiDraft): string[] =>
    d.criteria.flatMap((c) => [...c.strengths, ...c.improvements]);

  if (containsGradeHint(extractTexts(draft))) {
    // Regenerate once.
    draft = await attempt();

    if (containsGradeHint(extractTexts(draft))) {
      throw new Error("AI хариулт шалгуурыг давсан");
    }
  }

  return draft;
};
