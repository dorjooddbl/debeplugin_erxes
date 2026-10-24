import { ExpectedError } from "erxes-api-shared/utils";

// Input limits and date/score rules: docs/SPEC.md §5.

// 0 ≤ score ≤ maxScore. Scores are written only by Submissions.approve and
// Submissions.setScores, which both call this before writing.
export const assertScore = (score: number, maxScore: number): void => {
  if (!Number.isFinite(score) || score < 0 || score > maxScore) {
    throw new ExpectedError(`Оноо 0-ээс ${maxScore} хооронд байна`);
  }
};
