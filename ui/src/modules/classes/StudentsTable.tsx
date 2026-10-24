import { useMemo, useState } from "react";
import { IconSearch, IconUsers } from "@tabler/icons-react";
import { Badge, Button, Input, Table, ToggleGroup, cn } from "erxes-ui";
import type { EdureportAttendanceSummaryQuery, EdureportStudentListQuery } from "../../gql/graphql";
import { EmptyState } from "../states";

type Student = EdureportStudentListQuery["edureportStudentList"][number];
type Summary = EdureportAttendanceSummaryQuery["edureportAttendanceSummary"][number];
type Filter = "all" | "ok" | "atRisk";

const PAGE_SIZE = 10;

const isFilter = (value: string): value is Filter => ["all", "ok", "atRisk"].includes(value);

const RateBar = ({ rate, atRisk }: { rate: number; atRisk: boolean }) => (
  <div className="edureport:flex edureport:items-center edureport:gap-2">
    <div className="edureport:h-1.5 edureport:w-24 edureport:overflow-hidden edureport:rounded-full edureport:bg-muted">
      <div
        className={cn("edureport:h-full edureport:rounded-full", atRisk ? "edureport:bg-destructive" : "edureport:bg-success")}
        style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
      />
    </div>
    <span className={cn("edureport:text-xs edureport:font-medium", atRisk && "edureport:text-destructive")}>
      {rate}%
    </span>
  </div>
);

// Students of the class with their attendance over the summary window.
// `summary` is null while it loads or when the API could not provide it;
// the list still works, only the attendance columns show "—".
export const StudentsTable = ({
  students,
  summary,
  threshold,
}: {
  students: Student[];
  summary: Map<string, Summary> | null;
  threshold: number;
}) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    return students.filter((student) => {
      if (term && !student.code.toLowerCase().includes(term) && !student.name.toLowerCase().includes(term)) {
        return false;
      }

      if (filter === "all" || !summary) {
        return true;
      }

      const rate = summary.get(student._id)?.rate;
      const atRisk = rate !== null && rate !== undefined && rate < threshold;

      return filter === "atRisk" ? atRisk : !atRisk;
    });
  }, [students, search, filter, summary, threshold]);

  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  if (!students.length) {
    return (
      <EmptyState
        icon={IconUsers}
        title="Сурагч алга"
        description="«Сурагч нэмэх» эсвэл «Импортлох»-оор ангийн сурагчдыг оруулна."
      />
    );
  }

  return (
    <div className="edureport:flex edureport:flex-col edureport:gap-3">
      <div className="edureport:flex edureport:flex-wrap edureport:items-center edureport:gap-2">
        <div className="edureport:relative edureport:min-w-56 edureport:flex-1">
          <IconSearch className="edureport:absolute edureport:left-2.5 edureport:top-1/2 edureport:size-4 edureport:-translate-y-1/2 edureport:text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Сурагчийн код (S-001) эсвэл нэрээр хайх…"
            className="edureport:pl-8"
          />
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={filter}
          onValueChange={(value) => {
            if (isFilter(value)) {
              setFilter(value);
              setPage(1);
            }
          }}
        >
          <ToggleGroup.Item value="all">Бүгд</ToggleGroup.Item>
          <ToggleGroup.Item value="ok" disabled={!summary}>
            Хэвийн
          </ToggleGroup.Item>
          <ToggleGroup.Item value="atRisk" disabled={!summary}>
            Анхаарах
          </ToggleGroup.Item>
        </ToggleGroup>
      </div>
      <div className="edureport:overflow-hidden edureport:rounded-lg edureport:border edureport:border-border">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head className="edureport:w-24">Код</Table.Head>
              <Table.Head>Овог нэр</Table.Head>
              <Table.Head>Ирц (8 долоо хоног)</Table.Head>
              <Table.Head className="edureport:text-right">Тасалсан</Table.Head>
              <Table.Head className="edureport:text-right">Хоцорсон</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((student) => {
              const row = summary?.get(student._id);
              const rate = row?.rate;
              const atRisk = rate !== null && rate !== undefined && rate < threshold;

              return (
                <Table.Row key={student._id}>
                  <Table.Cell>
                    <Badge variant="secondary" className="edureport:font-mono">
                      {student.code}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="edureport:font-medium">{student.name}</Table.Cell>
                  <Table.Cell>
                    {rate === null || rate === undefined ? (
                      <span className="edureport:text-muted-foreground">—</span>
                    ) : (
                      <RateBar rate={rate} atRisk={atRisk} />
                    )}
                  </Table.Cell>
                  <Table.Cell className="edureport:text-right">{row ? row.absences : "—"}</Table.Cell>
                  <Table.Cell className="edureport:text-right">{row ? row.lates : "—"}</Table.Cell>
                </Table.Row>
              );
            })}
            {!rows.length && (
              <Table.Row>
                <Table.Cell colSpan={5} className="edureport:py-6 edureport:text-center edureport:text-muted-foreground">
                  Хайлтад тохирох сурагч алга
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      </div>
      <div className="edureport:flex edureport:items-center edureport:justify-between edureport:gap-2 edureport:text-xs edureport:text-muted-foreground">
        <span>
          Нийт {visible.length} сурагчаас {rows.length ? (current - 1) * PAGE_SIZE + 1 : 0}–
          {(current - 1) * PAGE_SIZE + rows.length} харуулж байна
        </span>
        <div className="edureport:flex edureport:items-center edureport:gap-1">
          <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
            Өмнөх
          </Button>
          <span className="edureport:px-2">
            {current} / {pages}
          </span>
          <Button variant="outline" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>
            Дараах
          </Button>
        </div>
      </div>
    </div>
  );
};
