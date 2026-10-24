import { useQuery } from "@apollo/client";
import { IconSparkles } from "@tabler/icons-react";
import { useQueryState } from "erxes-ui";
import { useEffect } from "react";
import { ASSIGNMENT_LIST, RUBRIC_LIST } from "../graphql/essays";
import { ClassBar } from "../modules/ClassBar";
import { AssignmentBar } from "../modules/essays/AssignmentBar";
import { EssayReview } from "../modules/essays/EssayReview";
import { TaskScores } from "../modules/essays/TaskScores";
import { PageShell } from "../modules/PageShell";
import { ErrorState } from "../modules/states";
import { useCurrentClass } from "../modules/useCurrentClass";

const Assignments = ({ classId }: { classId: string }) => {
  const assignments = useQuery(ASSIGNMENT_LIST, { variables: { classId } });
  const rubrics = useQuery(RUBRIC_LIST);
  const [rawId, setAssignmentId] = useQueryState<string>("assignmentId");

  const rows = assignments.data?.edureportAssignmentList ?? [];
  const requested = rawId === null ? null : String(rawId);
  // Essays first: they are what this page is mostly for.
  const fallback = rows.find(({ kind }) => kind === "essay") ?? rows[0];
  const current = rows.find(({ _id }) => _id === requested) ?? null;

  useEffect(() => {
    if (assignments.data && !current && fallback) {
      setAssignmentId(fallback._id);
    }
  }, [assignments.data, current, fallback, setAssignmentId]);

  if (assignments.error && !assignments.data) {
    return (
      <ErrorState title="Даалгавруудыг ачаалж чадсангүй" error={assignments.error} onRetry={() => assignments.refetch()} />
    );
  }

  const rubric = current?.rubricId
    ? (rubrics.data?.edureportRubricList.find(({ _id }) => _id === current.rubricId) ?? null)
    : null;

  return (
    <>
      <AssignmentBar
        classId={classId}
        assignments={rows}
        loading={assignments.loading}
        selectedId={current?._id ?? null}
        onSelect={setAssignmentId}
      />
      {current &&
        (current.kind === "essay" ? (
          <EssayReview key={current._id} classId={classId} assignment={current} rubric={rubric} />
        ) : (
          <TaskScores key={current._id} classId={classId} assignment={current} />
        ))}
    </>
  );
};

export const EssaysPage = () => {
  const currentClass = useCurrentClass();
  const classId = currentClass.current?._id;

  return (
    <PageShell title="Эссэ & AI үнэлгээ" icon={IconSparkles} iconName="IconSparkles" to="essays">
      <ClassBar {...currentClass} />
      {classId && <Assignments key={classId} classId={classId} />}
    </PageShell>
  );
};
