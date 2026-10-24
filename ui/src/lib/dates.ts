// Calendar dates as the API stores them: 'YYYY-MM-DD' in the teacher's
// local time zone (docs/SPEC.md §3).

export const toDateString = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
};

export const fromDateString = (value: string): Date => {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
};

export const addDays = (value: string, days: number): string => {
  const date = fromDateString(value);
  date.setDate(date.getDate() + days);

  return toDateString(date);
};

export const today = (): string => toDateString(new Date());

// The last eight weeks up to today, the window the class pages summarize.
export const lastEightWeeks = (): { from: string; to: string } => {
  const to = today();

  return { from: addDays(to, -55), to };
};

const WEEKDAYS = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];

export const weekdayShort = (value: string): string =>
  WEEKDAYS[fromDateString(value).getDay()] ?? "";

// "10/14" style label for table headers.
export const monthDay = (value: string): string => {
  const date = fromDateString(value);

  return `${date.getMonth() + 1}/${date.getDate()}`;
};

// Monday of the week that contains `value`.
export const startOfWeek = (value: string): string => {
  const weekday = fromDateString(value).getDay();

  return addDays(value, weekday === 0 ? -6 : 1 - weekday);
};

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : `${toDateString(date)} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};
