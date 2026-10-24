import { useMutation, useQuery } from "@apollo/client";
import { useMemo, useState } from "react";
import { IconCheck, IconUsers } from "@tabler/icons-react";
import { Badge, Button, Input, Table, toast } from "erxes-ui";
import { STUDENT_LIST } from "../../graphql/classes";
import { SCORES_SET, SUBMISSION_LIST } from "../../graphql/essays";
import type { EdureportAssignmentListQuery } from "../../gql/graphql";
import { EmptyState, ErrorState, LoadingBlock } from "../states";

type Assignment = EdureportAssignmentListQuery["edureportAssignmentList"][number];

// One call takes at most 200 entries (docs/SPEC.md §5).
const MAX_ENTRIES = 200;

// Scores for a task assignment: the teacher types them, saving upserts
// approved scores (edureportScoresSet).
export const TaskScores = ({ classId, assignment }: { classId: string; assignment: Assignment }) => {
  const students = useQuery(STUDENT_LIST, { variables: { classId } });
  const submissions = useQuery(SUBMISSION_LIST, { variables: { assignmentId: assignment._id } });
  const [values, setValues] = useState<Record<string, string>>({});
  const [setScores, { loading: saving }] = useMutation(SCORES_SET, {
    refetchQueries: ["edureportSubmissionList"],
    awaitRefetchQueries: true,
  });

  const saved = useMemo(
    () =>
      new Map(
        (submissions.data?.edureportSubmissionList ?? [])
          .filter(({ status, score }) => status === "approved" && score !== null && score !== undefined)
          .map(({ studentId, score }) => [studentId, score ?? 0]),
      ),
    [submissions.data],
  );

  const rows = students.data?.edureportStudentList ?? [];
  const valueOf = (studentId: string) => values[studentId] ?? saved.get(studentId)?.toString() ?? "";
  const changed = Object.entries(values).filter(
    ([studentId, value]) => value.trim() !== "" && Number(value) !== saved.get(studentId),
  );
  const invalid = changed.filter(([, value]) => {
    const score = Number(value);

    return !Number.isFinite(score) || score < 0 || score > assignment.maxScore;
  });

  const save = async () => {
    const entries = changed.map(([studentId, value]) => ({ studentId, score: Number(value) }));

    try {
      for (let i = 0; i < entries.length; i += MAX_ENTRIES) {
        await setScores({ variables: { assignmentId: assignment._id, entries: entries.slice(i, i + MAX_ENTRIES) } });
      }

      setValues({});
      toast({ title: `${entries.length} сурагчийн оноо хадгалагдлаа`, variant: "success" });
    } catch (error) {
      toast({
        title: "Оноо хадгалж чадсангүй",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  if (students.error || submissions.error) {
    const error = students.error ?? submissions.error;

    return error ? (
      <ErrorState
        error={error}
        onRetry={() => {
          students.refetch();
          submissions.refetch();
        }}
      />
    ) : null;
  }

  if ((students.loading && !students.data) || (submissions.loading && !submissions.data)) {
    return <LoadingBlock rows={8} />;
  }

  if (!rows.length) {
    return <EmptyState icon={IconUsers} title="Сурагч алга" description="Эхлээд ангидаа сурагч оруулна." />;
  }

  return (
    <section className="edureport:flex edureport:flex-col edureport:gap-3 edureport:rounded-lg edureport:border edureport:border-border edureport:bg-background edureport:p-4 edureport:shadow-xs">
      <div className="edureport:flex edureport:flex-wrap edureport:items-center edureport:gap-2">
        <span className="edureport:text-sm edureport:text-muted-foreground">
          Дээд оноо {assignment.maxScore} · {saved.size}/{rows.length} сурагч оноотой
        </span>
        <Button size="sm" className="edureport:ml-auto" onClick={save} disabled={!changed.length || Boolean(invalid.length) || saving}>
          <IconCheck />
          {saving ? "Хадгалж байна…" : `Оноо хадгалах${changed.length ? ` (${changed.length})` : ""}`}
        </Button>
      </div>
      {invalid.length > 0 && (
        <p className="edureport:text-sm edureport:text-destructive">
          Оноо 0-ээс {assignment.maxScore} хооронд байна
        </p>
      )}
      <div className="edureport:overflow-hidden edureport:rounded-lg edureport:border edureport:border-border">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head className="edureport:w-24">Код</Table.Head>
              <Table.Head>Овог нэр</Table.Head>
              <Table.Head className="edureport:w-40">Оноо</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((student) => (
              <Table.Row key={student._id}>
                <Table.Cell>
                  <Badge variant="secondary" className="edureport:font-mono">
                    {student.code}
                  </Badge>
                </Table.Cell>
                <Table.Cell className="edureport:font-medium">{student.name}</Table.Cell>
                <Table.Cell>
                  <div className="edureport:flex edureport:items-center edureport:gap-1.5">
                    <Input
                      aria-label={`${student.name}: оноо`}
                      inputMode="decimal"
                      className="edureport:w-20"
                      value={valueOf(student._id)}
                      onChange={(event) =>
                        setValues((current) => ({ ...current, [student._id]: event.target.value }))
                      }
                    />
                    <span className="edureport:text-xs edureport:text-muted-foreground">/ {assignment.maxScore}</span>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </section>
  );
};
