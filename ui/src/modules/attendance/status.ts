import type { EdureportAttendanceStatus } from "../../gql/graphql";

// Labels, short codes and colors for the four SPEC attendance statuses.
export const STATUS: Record<
  EdureportAttendanceStatus,
  { label: string; short: string; className: string }
> = {
  present: {
    label: "Ирсэн",
    short: "И",
    className: "edureport:bg-success/15 edureport:text-success",
  },
  late: {
    label: "Хоцорсон",
    short: "Х",
    className: "edureport:bg-warning/15 edureport:text-warning",
  },
  excused: {
    label: "Чөлөөтэй",
    short: "Ч",
    className: "edureport:bg-info/15 edureport:text-info",
  },
  absent: {
    label: "Тасалсан",
    short: "Т",
    className: "edureport:bg-destructive/15 edureport:text-destructive",
  },
};

// Click order when a teacher taps a cell.
export const STATUS_ORDER: EdureportAttendanceStatus[] = ["present", "late", "excused", "absent"];

export const nextStatus = (status: EdureportAttendanceStatus): EdureportAttendanceStatus =>
  STATUS_ORDER[(STATUS_ORDER.indexOf(status) + 1) % STATUS_ORDER.length] ?? "present";
