import { ExpectedError } from "erxes-api-shared/utils";
import { z } from "zod";

// Input limits and date/score rules: docs/SPEC.md §5.

export const MAX_ENTRIES = 200;
export const MAX_ROWS = 200;
export const MAX_ITEMS = 100;
export const MAX_ESSAY_LENGTH = 20_000;

// Bounded pagination for list queries (AGENTS.md), the template's 1–100 range.
export const DEFAULT_PER_PAGE = 20;
export const MAX_PER_PAGE = 100;

// 0 ≤ score ≤ maxScore. Scores are written only by Submissions.approve and
// Submissions.setScores, which both call this before writing.
export const assertScore = (score: number, maxScore: number): void => {
  if (!Number.isFinite(score) || score < 0 || score > maxScore) {
    throw new ExpectedError(`Оноо 0-ээс ${maxScore} хооронд байна`);
  }
};

// A real calendar day as 'YYYY-MM-DD': `2026-02-30` is rejected.
export const assertDate = (value: string): void => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match && new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));

  if (!date || date.toISOString().slice(0, 10) !== value) {
    throw new ExpectedError(`Огноо буруу байна: "${value}" (YYYY-MM-DD)`);
  }
};

// 'YYYY-MM-DD' strings compare as dates.
export const assertDateRange = (from: string, to: string): void => {
  assertDate(from);
  assertDate(to);

  if (from > to) {
    throw new ExpectedError("Эхлэх огноо дуусах огнооноос хойш байна");
  }
};

export const assertMaxItems = (items: readonly unknown[], max: number): void => {
  if (items.length > max) {
    throw new ExpectedError(`Нэг удаад ${max}-аас ихгүй мөр илгээнэ`);
  }
};

// At-risk thresholds: 0–100.
export const assertPercent = (value: number | null | undefined, label: string): void => {
  if (value !== undefined && value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
    throw new ExpectedError(`${label} 0-ээс 100 хооронд байна`);
  }
};

const studentRowSchema = z.object({
  name: z.string().trim().min(1, "Нэр хоосон байна"),
  code: z.string().trim().min(1, "Код хоосон байна"),
});

// Each row is checked on its own: bad rows come back with their 1-based row
// number (as the teacher pasted them) and the rest are still imported.
export const parseStudentRows = (rows: readonly { name: string; code: string }[]) => {
  const valid: { name: string; code: string }[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((row, index) => {
    const result = studentRowSchema.safeParse(row);

    if (result.success) {
      valid.push(result.data);
    } else {
      errors.push({ row: index + 1, message: result.error.issues.map(({ message }) => message).join("; ") });
    }
  });

  return { valid, errors };
};

export const parsePage =({ page, perPage }: { page?: number | null; perPage?: number | null }) => {
  const pageNumber = page ?? 1;
  const size = perPage ?? DEFAULT_PER_PAGE;

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new ExpectedError("Хуудасны дугаар 1-ээс эхэлнэ");
  }

  if (!Number.isInteger(size) || size < 1 || size > MAX_PER_PAGE) {
    throw new ExpectedError(`Нэг хуудсанд 1-ээс ${MAX_PER_PAGE} мөр`);
  }

  return { skip: (pageNumber - 1) * size, limit: size };
};
