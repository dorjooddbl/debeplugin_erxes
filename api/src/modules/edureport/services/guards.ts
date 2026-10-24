// Quote, grade and number guards: docs/SPEC.md §7.
import type { ICriterionFeedback, IClassDocument, IReportMetrics } from "../@types/index.ts";

// Collapse all whitespace sequences (spaces, newlines, tabs) into a single space.
const normalizeWhitespace = (text: string): string => text.replace(/\s+/g, " ").trim();

// Strip evidenceQuote if it cannot be found (after whitespace normalization) in the essay.
export const stripInvalidQuotes = (
  criteria: ICriterionFeedback[],
  essayText: string,
): ICriterionFeedback[] => {
  const normalizedEssay = normalizeWhitespace(essayText);

  return criteria.map((c) => {
    if (!c.evidenceQuote) {
      return c;
    }

    const normalizedQuote = normalizeWhitespace(c.evidenceQuote);

    if (!normalizedEssay.includes(normalizedQuote)) {
      const { evidenceQuote: _removed, ...rest } = c;

      return rest;
    }

    return c;
  });
};

// Grade hint patterns:
// - fraction like "10/20" or "8 / 10"
// - numeric score like "85 оноо"
// - Latin grades A-F or Cyrillic А, В, С, Д followed by дүн or үнэлгээ
// - percentage like "85%" or "85.3%" or "85,3%"
const GRADE_PATTERNS = [
  /\d+\s*\/\s*\d+/,
  /\d+\s*оноо/i,
  /[A-Fa-f]\s*(?:дүн|үнэлгээ)/i,
  /[АВСДавсд]\s*(?:дүн|үнэлгээ)/,
  /\d+(?:[.,]\d+)?\s*%/,
];

export const containsGradeHint = (texts: string[]): boolean => {
  const combined = texts.join(" ");

  return GRADE_PATTERNS.some((pattern) => pattern.test(combined));
};

// Extract all numbers that appear in a metric's numeric fields.
const metricsNumbers = (metrics: IReportMetrics): Set<string> => {
  const nums = new Set<string>();

  const addNum = (value: number | null | undefined) => {
    if (value !== null && value !== undefined) {
      nums.add(String(value));
    }
  };

  addNum(metrics.studentCount);
  addNum(metrics.sessions);
  addNum(metrics.attendanceRate);
  addNum(metrics.avgScorePct);
  addNum(metrics.atRiskStudentIds.length);

  for (const s of metrics.perStudent) {
    addNum(s.attendanceRate);
    addNum(s.avgScorePct);
  }

  return nums;
};

// Extract year, month, day digits from a YYYY-MM-DD date string.
const dateNumbers = (dateStr: string): string[] => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);

  if (!match) {
    return [];
  }

  // year, month (no leading zero), day (no leading zero), and their original forms
  const year = match[1] as string;
  const month = match[2] as string;
  const day = match[3] as string;

  return [
    year,
    month,
    day,
    String(Number(month)), // drop leading zero
    String(Number(day)), // drop leading zero
  ];
};

// Extract numbers from class name and term strings.
const textNumbers = (text: string): string[] => {
  const matches = text.match(/\d+(?:[.,]\d+)?/g) ?? [];

  return matches.map((m) => m.replace(",", "."));
};

// Normalize a number string: replace comma-decimal with period-decimal.
const normalizeNumber = (numStr: string): string => numStr.replace(",", ".");

// Check numbers in aiSummary that are NOT in the allowed set.
// Returns warning strings for each suspicious number found.
export const checkReportNumbers = (
  aiSummary: string,
  metrics: IReportMetrics,
  cls: IClassDocument,
  from: string,
  to: string,
): string[] => {
  const allowed = new Set<string>();

  // Add all metric numbers.
  for (const n of metricsNumbers(metrics)) {
    allowed.add(n);
  }

  // Add date digits.
  for (const d of [...dateNumbers(from), ...dateNumbers(to)]) {
    allowed.add(d);
  }

  // Add numbers from class name and term.
  for (const n of [...textNumbers(cls.name), ...textNumbers(cls.term), ...(cls.grade ? textNumbers(cls.grade) : [])]) {
    allowed.add(n);
  }

  const warnings: string[] = [];

  // Find all numbers in aiSummary (with optional comma/period decimal).
  // Skip line-leading heading numbers like "1.", "2.", "10." at start of lines.
  const lines = aiSummary.split("\n");
  const headingNumbers = new Set<string>();

  for (const line of lines) {
    const headingMatch = /^\s*(\d+)\.\s/.exec(line);

    if (headingMatch) {
      headingNumbers.add(headingMatch[1] as string);
    }
  }

  const numberMatches = aiSummary.matchAll(/\d+(?:[.,]\d+)?/g);

  for (const match of numberMatches) {
    const rawNum = match[0];
    const normalized = normalizeNumber(rawNum);

    // Skip if it's a heading number.
    if (headingNumbers.has(rawNum)) {
      continue;
    }

    if (!allowed.has(normalized) && !allowed.has(rawNum)) {
      warnings.push(`Тоо "${rawNum}" статистикт байхгүй байна`);
    }
  }

  return warnings;
};
