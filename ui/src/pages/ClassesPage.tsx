import { useQuery } from "@apollo/client";
import { useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconCalendarCheck,
  IconFileImport,
  IconSchool,
  IconUserMinus,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { Button } from "erxes-ui";
import { ATTENDANCE_SUMMARY, CLASS_DETAIL, STUDENT_LIST } from "../graphql/classes";
import { lastEightWeeks } from "../lib/dates";
import { ClassBar } from "../modules/ClassBar";
import { ClassInfoCard, DEFAULT_ATTENDANCE_THRESHOLD } from "../modules/classes/ClassInfoCard";
import { StudentAddDialog } from "../modules/classes/StudentAddDialog";
import { StudentImportDialog } from "../modules/classes/StudentImportDialog";
import { StudentsTable } from "../modules/classes/StudentsTable";
import { PageShell } from "../modules/PageShell";
import { ErrorState, LoadingBlock, StatCard } from "../modules/states";
import { useCurrentClass } from "../modules/useCurrentClass";

const round1 = (value: number) => Math.round(value * 10) / 10;

const ClassContent = ({ classId }: { classId: string }) => {
  const range = useMemo(lastEightWeeks, []);
  const detail = useQuery(CLASS_DETAIL, { variables: { _id: classId } });
  const students = useQuery(STUDENT_LIST, { variables: { classId } });
  // Separate query: the class and its students still show if the summary fails.
  const summary = useQuery(ATTENDANCE_SUMMARY, { variables: { classId, ...range } });

  const cls = detail.data?.edureportClassDetail;
  const threshold = cls?.atRiskAttendancePct ?? DEFAULT_ATTENDANCE_THRESHOLD;
  const summaryRows = summary.data?.edureportAttendanceSummary;
  const summaryById = useMemo(
    () => (summaryRows ? new Map(summaryRows.map((row) => [row.studentId, row])) : null),
    [summaryRows],
  );

  // Display aggregates of the per-student rates the API computed (SPEC §6).
  const rates = (summaryRows ?? []).map(({ rate }) => rate).filter((rate): rate is number => rate !== null);
  const averageRate = rates.length ? round1(rates.reduce((sum, rate) => sum + rate, 0) / rates.length) : null;
  const atRiskCount = rates.filter((rate) => rate < threshold).length;
  const absences = (summaryRows ?? []).reduce((sum, row) => sum + row.absences, 0);
  const summaryPending = summary.loading && !summaryRows;
  const summaryFailed = Boolean(summary.error) && !summaryRows;

  return (
    <>
      <div className="edureport:grid edureport:gap-3 edureport:sm:grid-cols-2 edureport:xl:grid-cols-4">
        <StatCard
          label="Нийт сурагч"
          icon={IconUsers}
          value={cls?.studentCount ?? "—"}
          loading={detail.loading && !cls}
          hint={cls ? `${cls.name} · ${cls.subject}` : undefined}
        />
        <StatCard
          label="Дундаж ирц"
          icon={IconCalendarCheck}
          value={averageRate === null ? "—" : `${averageRate}%`}
          loading={summaryPending}
          failed={summaryFailed}
          hint="Сурагчдын ирцийн дундаж, сүүлийн 8 долоо хоног"
        />
        <StatCard
          label="Анхаарах сурагч"
          icon={IconAlertTriangle}
          value={atRiskCount}
          loading={summaryPending}
          failed={summaryFailed}
          hint={`Ирц ${threshold}%-иас доош`}
        />
        <StatCard
          label="Нийт тасалсан"
          icon={IconUserMinus}
          value={absences}
          loading={summaryPending}
          failed={summaryFailed}
          hint="Тасалсан хичээл, сүүлийн 8 долоо хоног"
        />
      </div>
      <div className="edureport:grid edureport:items-start edureport:gap-4 edureport:lg:grid-cols-[1fr_18rem]">
        <section className="edureport:flex edureport:flex-col edureport:gap-3 edureport:rounded-lg edureport:border edureport:border-border edureport:bg-background edureport:p-4 edureport:shadow-xs">
          {summaryFailed && summary.error && (
            <ErrorState
              title="Ирцийн хураангуй ачаалагдсангүй"
              error={summary.error}
              onRetry={() => summary.refetch()}
            />
          )}
          {students.error ? (
            <ErrorState
              title="Сурагчдыг ачаалж чадсангүй"
              error={students.error}
              onRetry={() => students.refetch()}
            />
          ) : students.loading && !students.data ? (
            <LoadingBlock rows={6} />
          ) : (
            <StudentsTable
              students={students.data?.edureportStudentList ?? []}
              summary={summaryById}
              threshold={threshold}
            />
          )}
        </section>
        <aside>
          {detail.error ? (
            <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
          ) : cls ? (
            <ClassInfoCard cls={cls} />
          ) : (
            <LoadingBlock rows={6} />
          )}
        </aside>
      </div>
    </>
  );
};

export const ClassesPage = () => {
  const currentClass = useCurrentClass();
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const classId = currentClass.current?._id;

  return (
    <PageShell
      title="Анги, сурагчид"
      icon={IconSchool}
      iconName="IconSchool"
      to="classes"
      actions={
        classId && (
          <>
            <Button variant="outline" onClick={() => setImporting(true)}>
              <IconFileImport />
              Excel / CSV импорт
            </Button>
            <Button onClick={() => setAdding(true)}>
              <IconUserPlus />
              Сурагч нэмэх
            </Button>
          </>
        )
      }
    >
      <ClassBar {...currentClass} />
      {classId && (
        <>
          <ClassContent key={classId} classId={classId} />
          <StudentImportDialog classId={classId} open={importing} onOpenChange={setImporting} />
          <StudentAddDialog classId={classId} open={adding} onOpenChange={setAdding} />
        </>
      )}
    </PageShell>
  );
};
