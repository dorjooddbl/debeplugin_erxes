import { useMutation, useQuery } from "@apollo/client";
import { useMemo, useState } from "react";
import {
  IconCalendarEvent,
  IconCheck,
  IconChecks,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconUserCheck,
  IconUserMinus,
  IconUsers,
} from "@tabler/icons-react";
import { Badge, Button, Table, cn, toast, useConfirm } from "erxes-ui";
import { ATTENDANCE_LIST, ATTENDANCE_MARK } from "../../graphql/attendance";
import { ATTENDANCE_SUMMARY, STUDENT_LIST } from "../../graphql/classes";
import type { EdureportAttendanceStatus } from "../../gql/graphql";
import { addDays, monthDay, startOfWeek, today, weekdayShort } from "../../lib/dates";
import { EmptyState, ErrorState, LoadingBlock, StatCard } from "../states";
import { STATUS, STATUS_ORDER, nextStatus } from "./status";

const SCHOOL_DAYS = 5;
// One mark call takes at most 200 entries (docs/SPEC.md §5).
const MAX_ENTRIES = 200;

const markKey = (studentId: string, date: string) => `${studentId}|${date}`;

const percent = (count: number, total: number) => (total ? `${Math.round((count / total) * 1000) / 10}%` : "—");

// The day a week opens on: the latest school day up to today (Friday on a
// weekend, today on a school day).
const defaultDay = (weekStart: string) => {
  const now = today();
  const end = addDays(weekStart, SCHOOL_DAYS - 1);

  if (now > end) {
    return end;
  }

  return now >= weekStart ? now : weekStart;
};

// One school week of one class: the saved marks as a matrix, with the
// selected day editable. A day nobody marked yet starts with everyone
// present (docs/PLAN.md §5.2); saving upserts, so marking again replaces.
export const AttendanceWeek = ({ classId }: { classId: string }) => {
  const now = today();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now));
  const [editDate, setEditDate] = useState(() => defaultDay(startOfWeek(now)));
  const [edits, setEdits] = useState<Record<string, EdureportAttendanceStatus>>({});
  const { confirm } = useConfirm();

  const days = useMemo(
    () => Array.from({ length: SCHOOL_DAYS }, (_value, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekEnd = days[days.length - 1] ?? weekStart;
  const range = { classId, from: weekStart, to: weekEnd };

  const students = useQuery(STUDENT_LIST, { variables: { classId } });
  const list = useQuery(ATTENDANCE_LIST, { variables: range });
  // Separate query: the matrix still works if the summary is unavailable.
  const summary = useQuery(ATTENDANCE_SUMMARY, { variables: range });

  const [mark, { loading: saving }] = useMutation(ATTENDANCE_MARK, {
    refetchQueries: ["edureportAttendanceList", "edureportAttendanceSummary"],
    awaitRefetchQueries: true,
  });

  const studentRows = students.data?.edureportStudentList ?? [];
  const marks = useMemo(
    () => new Map((list.data?.edureportAttendanceList ?? []).map((row) => [markKey(row.studentId, row.date), row.status])),
    [list.data],
  );
  const rateById = useMemo(
    () => new Map((summary.data?.edureportAttendanceSummary ?? []).map((row) => [row.studentId, row.rate])),
    [summary.data],
  );

  const saved = (studentId: string) => marks.get(markKey(studentId, editDate));
  const effective = (studentId: string) => edits[studentId] ?? saved(studentId) ?? "present";
  const dirty = Object.entries(edits).some(([studentId, status]) => status !== (saved(studentId) ?? "present"));
  const unmarked = studentRows.some(({ _id }) => !saved(_id));
  const canSave = Boolean(studentRows.length) && (dirty || unmarked);

  // Moving away drops unsaved edits; ask first (in-app dialog).
  const leaveDay = async (go: () => void) => {
    if (dirty) {
      await confirm({
        message: "Хадгалаагүй өөрчлөлт устна. Үргэлжлүүлэх үү?",
        options: { okLabel: "Үргэлжлүүлэх", cancelLabel: "Болих" },
      });
    }

    setEdits({});
    go();
  };

  const showWeek = (start: string) =>
    leaveDay(() => {
      setWeekStart(start);
      setEditDate(defaultDay(start));
    });

  const save = async () => {
    const entries = studentRows.map(({ _id }) => ({ studentId: _id, status: effective(_id) }));

    try {
      for (let i = 0; i < entries.length; i += MAX_ENTRIES) {
        await mark({ variables: { classId, date: editDate, entries: entries.slice(i, i + MAX_ENTRIES) } });
      }

      setEdits({});
      toast({ title: `${editDate}: ${entries.length} сурагчийн ирц хадгалагдлаа`, variant: "success" });
    } catch (error) {
      toast({
        title: "Ирц хадгалж чадсангүй",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const weekMarks = [...marks.values()];
  const count = (status: EdureportAttendanceStatus) => weekMarks.filter((value) => value === status).length;
  const listPending = list.loading && !list.data;

  if (students.error) {
    return <ErrorState title="Сурагчдыг ачаалж чадсангүй" error={students.error} onRetry={() => students.refetch()} />;
  }

  if (students.loading && !students.data) {
    return <LoadingBlock rows={8} />;
  }

  if (!studentRows.length) {
    return (
      <EmptyState
        icon={IconUsers}
        title="Сурагч алга"
        description="Ирц бүртгэхийн өмнө «Анги, сурагчид» хуудаснаас сурагчдаа оруулна."
      />
    );
  }

  return (
    <div className="edureport:flex edureport:flex-col edureport:gap-4">
      <div className="edureport:grid edureport:gap-3 edureport:sm:grid-cols-2 edureport:xl:grid-cols-4">
        <StatCard label="Ирсэн" icon={IconUserCheck} value={percent(count("present"), weekMarks.length)} loading={listPending} hint={`${count("present")} тэмдэглэгээ`} />
        <StatCard label="Тасалсан" icon={IconUserMinus} value={percent(count("absent"), weekMarks.length)} loading={listPending} hint={`${count("absent")} тэмдэглэгээ`} />
        <StatCard label="Чөлөөтэй" icon={IconCalendarEvent} value={percent(count("excused"), weekMarks.length)} loading={listPending} hint={`${count("excused")} тэмдэглэгээ`} />
        <StatCard label="Хоцорсон" icon={IconClock} value={percent(count("late"), weekMarks.length)} loading={listPending} hint={`${count("late")} тэмдэглэгээ`} />
      </div>

      <section className="edureport:flex edureport:flex-col edureport:gap-3 edureport:rounded-lg edureport:border edureport:border-border edureport:bg-background edureport:p-4 edureport:shadow-xs">
        <div className="edureport:flex edureport:flex-wrap edureport:items-center edureport:gap-2">
          <Button variant="outline" size="icon" aria-label="Өмнөх 7 хоног" onClick={() => showWeek(addDays(weekStart, -7))}>
            <IconChevronLeft />
          </Button>
          <span className="edureport:min-w-32 edureport:text-center edureport:text-sm edureport:font-medium">
            {monthDay(weekStart)} – {monthDay(weekEnd)}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Дараагийн 7 хоног"
            disabled={addDays(weekStart, 7) > now}
            onClick={() => showWeek(addDays(weekStart, 7))}
          >
            <IconChevronRight />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => showWeek(startOfWeek(now))}>
            Энэ 7 хоног
          </Button>
          <div className="edureport:ml-auto edureport:flex edureport:flex-wrap edureport:items-center edureport:gap-2">
            <span className="edureport:text-xs edureport:text-muted-foreground">
              Засах өдөр: <span className="edureport:font-medium edureport:text-foreground">{editDate}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setEdits(Object.fromEntries(studentRows.map(({ _id }) => [_id, "present" as const])))
              }
            >
              <IconChecks />
              Бүгдийг ирсэн болгох
            </Button>
            <Button size="sm" onClick={save} disabled={!canSave || saving}>
              <IconCheck />
              {saving ? "Хадгалж байна…" : "Ирц хадгалах"}
            </Button>
          </div>
        </div>

        {list.error && <ErrorState title="Ирцийг ачаалж чадсангүй" error={list.error} onRetry={() => list.refetch()} />}
        {summary.error && !summary.data && (
          <ErrorState title="Ирцийн хувь ачаалагдсангүй" error={summary.error} onRetry={() => summary.refetch()} />
        )}

        <div className="edureport:flex edureport:flex-wrap edureport:gap-3 edureport:text-xs edureport:text-muted-foreground">
          {STATUS_ORDER.map((status) => (
            <span key={status} className="edureport:flex edureport:items-center edureport:gap-1.5">
              <span className={cn("edureport:rounded edureport:px-1.5 edureport:font-semibold", STATUS[status].className)}>
                {STATUS[status].short}
              </span>
              {STATUS[status].label}
            </span>
          ))}
          <span>· Засах өдрийн нүдийг дарж төлөвийг солино</span>
        </div>

        <div className="edureport:overflow-x-auto edureport:rounded-lg edureport:border edureport:border-border">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head className="edureport:w-20">Код</Table.Head>
                <Table.Head>Сурагчийн нэр</Table.Head>
                {days.map((date) => {
                  const future = date > now;
                  const active = date === editDate;

                  return (
                    <Table.Head key={date} className="edureport:text-center">
                      <button
                        type="button"
                        disabled={future}
                        onClick={() => leaveDay(() => setEditDate(date))}
                        className={cn(
                          "edureport:flex edureport:w-full edureport:flex-col edureport:items-center edureport:rounded-md edureport:px-2 edureport:py-1 edureport:text-xs",
                          active ? "edureport:bg-primary edureport:text-primary-foreground" : "edureport:hover:bg-accent",
                          future && "edureport:cursor-not-allowed edureport:opacity-40",
                        )}
                      >
                        <span className="edureport:font-semibold">{weekdayShort(date)}</span>
                        <span>{date === now ? "Өнөөдөр" : monthDay(date)}</span>
                      </button>
                    </Table.Head>
                  );
                })}
                <Table.Head className="edureport:text-right">Ирсэн</Table.Head>
                <Table.Head className="edureport:text-right">Тасалсан</Table.Head>
                <Table.Head className="edureport:text-right">Ирц %</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {studentRows.map((student) => {
                const week = days.map((date) => marks.get(markKey(student._id, date)));
                const attended = week.filter((status) => status === "present" || status === "late").length;
                const absent = week.filter((status) => status === "absent").length;
                const rate = rateById.get(student._id);

                return (
                  <Table.Row key={student._id} className={cn(absent >= 2 && "edureport:bg-destructive/5")}>
                    <Table.Cell>
                      <Badge variant="secondary" className="edureport:font-mono">
                        {student.code}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="edureport:font-medium">{student.name}</Table.Cell>
                    {days.map((date, index) => {
                      if (date === editDate) {
                        const status = effective(student._id);
                        const changed = status !== (saved(student._id) ?? "present") || !saved(student._id);

                        return (
                          <Table.Cell key={date} className="edureport:text-center">
                            <button
                              type="button"
                              title={STATUS[status].label}
                              aria-label={`${student.name}: ${STATUS[status].label}`}
                              onClick={() =>
                                setEdits((current) => ({ ...current, [student._id]: nextStatus(status) }))
                              }
                              className={cn(
                                "edureport:size-8 edureport:rounded-md edureport:text-sm edureport:font-semibold edureport:ring-1 edureport:ring-primary/40",
                                STATUS[status].className,
                                changed && "edureport:ring-2 edureport:ring-primary",
                              )}
                            >
                              {STATUS[status].short}
                            </button>
                          </Table.Cell>
                        );
                      }

                      const status = week[index];

                      return (
                        <Table.Cell key={date} className="edureport:text-center">
                          {status ? (
                            <span
                              title={STATUS[status].label}
                              className={cn(
                                "edureport:inline-flex edureport:size-7 edureport:items-center edureport:justify-center edureport:rounded-md edureport:text-xs edureport:font-semibold",
                                STATUS[status].className,
                              )}
                            >
                              {STATUS[status].short}
                            </span>
                          ) : (
                            <span className="edureport:text-muted-foreground">·</span>
                          )}
                        </Table.Cell>
                      );
                    })}
                    <Table.Cell className="edureport:text-right">{attended} өдөр</Table.Cell>
                    <Table.Cell className={cn("edureport:text-right", absent > 0 && "edureport:font-semibold edureport:text-destructive")}>
                      {absent}
                    </Table.Cell>
                    <Table.Cell className="edureport:text-right">
                      {rate === null || rate === undefined ? "—" : `${rate}%`}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>
        <span className="edureport:text-xs edureport:text-muted-foreground">
          {unmarked
            ? `${editDate}-нд бүртгэгдээгүй сурагчид «Ирсэн» гэж урьдчилан тэмдэглэгдсэн — хадгалахад бүртгэгдэнэ.`
            : "Дахин тэмдэглэхэд хуучныг нь солино, давхардахгүй."}
        </span>
      </section>
    </div>
  );
};
