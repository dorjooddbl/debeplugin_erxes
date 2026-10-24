import { useQuery } from "@apollo/client";
import { type ReactNode, useMemo, useState } from "react";
import {
  IconArrowRight,
  IconCheck,
  IconCircleCheck,
  IconFileText,
  IconFileUpload,
  IconQuote,
  IconSearch,
  IconSparkles,
} from "@tabler/icons-react";
import { Badge, Button, Input, ToggleGroup, cn } from "erxes-ui";
import { STUDENT_LIST } from "../../graphql/classes";
import { SUBMISSION_DETAIL, SUBMISSION_LIST } from "../../graphql/essays";
import type { EdureportAssignmentListQuery, EdureportRubricListQuery } from "../../gql/graphql";
import { formatDateTime } from "../../lib/dates";
import { EmptyState, ErrorState, LoadingBlock, StatCard } from "../states";
import { ApprovePanel } from "./ApprovePanel";
import { FeedbackBanner } from "./FeedbackBanner";
import { SUBMISSION_STATUS } from "./status";
import { SubmissionsAddDialog } from "./SubmissionsAddDialog";

type Assignment = EdureportAssignmentListQuery["edureportAssignmentList"][number];
type Rubric = EdureportRubricListQuery["edureportRubricList"][number];
type Filter = "all" | "aiDrafted" | "approved" | "waiting";

const isFilter = (value: string): value is Filter => ["all", "aiDrafted", "approved", "waiting"].includes(value);

const Panel = ({ title, icon: Icon, children }: { title: string; icon: typeof IconFileText; children: ReactNode }) => (
  <section className="edureport:flex edureport:min-w-0 edureport:flex-col edureport:gap-3 edureport:rounded-lg edureport:border edureport:border-border edureport:bg-background edureport:p-4 edureport:shadow-xs">
    <h3 className="edureport:flex edureport:items-center edureport:gap-2 edureport:text-sm edureport:font-semibold">
      <Icon className="edureport:size-4 edureport:text-primary" />
      {title}
    </h3>
    {children}
  </section>
);

// Essays of one assignment: the list, the selected essay, its AI draft per
// rubric criterion and the teacher's approval (docs/PLAN.md §5.4).
export const EssayReview = ({
  classId,
  assignment,
  rubric,
}: {
  classId: string;
  assignment: Assignment;
  rubric: Rubric | null;
}) => {
  const students = useQuery(STUDENT_LIST, { variables: { classId } });
  const list = useQuery(SUBMISSION_LIST, { variables: { assignmentId: assignment._id } });
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const studentById = useMemo(
    () => new Map((students.data?.edureportStudentList ?? []).map((student) => [student._id, student])),
    [students.data],
  );
  const titles = useMemo(
    () => new Map((rubric?.criteria ?? []).map(({ key, title }) => [key, title])),
    [rubric],
  );

  const submissions = list.data?.edureportSubmissionList ?? [];
  const count = (...statuses: string[]) => submissions.filter(({ status }) => statuses.includes(status)).length;
  const term = search.trim().toLowerCase();
  // By student code, the order teachers keep their class list in.
  const codeOf = (studentId: string) => studentById.get(studentId)?.code ?? "";
  const rows = [...submissions].sort((x, y) => codeOf(x.studentId).localeCompare(codeOf(y.studentId))).filter((submission) => {
    const student = studentById.get(submission.studentId);

    if (term && !`${student?.code ?? ""} ${student?.name ?? ""}`.toLowerCase().includes(term)) {
      return false;
    }

    if (filter === "aiDrafted") return submission.status === "aiDrafted";
    if (filter === "approved") return submission.status === "approved";
    if (filter === "waiting") return ["submitted", "queued", "failed"].includes(submission.status);

    return true;
  });

  const selected = rows.find(({ _id }) => _id === selectedId) ?? rows[0] ?? null;
  const detail = useQuery(SUBMISSION_DETAIL, {
    variables: { _id: selected?._id ?? "" },
    skip: !selected,
  });
  const essay = detail.data?.edureportSubmissionDetail;
  const author = selected ? studentById.get(selected.studentId) : undefined;
  const listError = list.error ?? students.error;

  return (
    <div className="edureport:flex edureport:flex-col edureport:gap-4">
      <div className="edureport:flex edureport:flex-wrap edureport:items-start edureport:justify-between edureport:gap-3">
        <div className="edureport:flex edureport:flex-col edureport:gap-1">
          <h2 className="edureport:text-xl edureport:font-semibold">{assignment.title}</h2>
          <span className="edureport:text-xs edureport:text-muted-foreground">
            Дээд оноо {assignment.maxScore}
            {assignment.dueDate ? ` · Хугацаа ${assignment.dueDate}` : ""}
            {rubric ? ` · ${rubric.name}: ${rubric.criteria.map(({ title }) => title).join(", ")}` : ""}
          </span>
        </div>
        <Button variant="outline" onClick={() => setAdding(true)}>
          <IconFileUpload />
          Эссэ оруулах
        </Button>
      </div>

      <div className="edureport:grid edureport:gap-3 edureport:sm:grid-cols-3">
        <StatCard label="Нийт ирсэн" icon={IconFileText} value={submissions.length} loading={list.loading && !list.data} />
        <StatCard label="AI ноорог бэлэн" icon={IconSparkles} value={count("aiDrafted")} loading={list.loading && !list.data} />
        <StatCard label="Батлагдсан" icon={IconCircleCheck} value={count("approved")} loading={list.loading && !list.data} />
      </div>

      <FeedbackBanner assignmentId={assignment._id} pending={count("submitted", "failed")} />

      {listError ? (
        <ErrorState title="Эссэнүүдийг ачаалж чадсангүй" error={listError} onRetry={() => list.refetch()} />
      ) : list.loading && !list.data ? (
        <LoadingBlock rows={6} />
      ) : !submissions.length ? (
        <EmptyState icon={IconFileText} title="Эссэ алга" description="«Эссэ оруулах»-оор сурагчдын эссэг буулгана.">
          <Button onClick={() => setAdding(true)}>
            <IconFileUpload />
            Эссэ оруулах
          </Button>
        </EmptyState>
      ) : (
        <div className="edureport:grid edureport:items-start edureport:gap-4 edureport:xl:grid-cols-[18rem_1fr_22rem]">
          <Panel title="Эссэнүүд" icon={IconFileText}>
            <div className="edureport:relative">
              <IconSearch className="edureport:absolute edureport:left-2.5 edureport:top-1/2 edureport:size-4 edureport:-translate-y-1/2 edureport:text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Код эсвэл нэрээр хайх…"
                className="edureport:pl-8"
              />
            </div>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={filter}
              onValueChange={(value) => isFilter(value) && setFilter(value)}
              className="edureport:flex-wrap"
            >
              <ToggleGroup.Item value="all">Бүгд ({submissions.length})</ToggleGroup.Item>
              <ToggleGroup.Item value="aiDrafted">Ноорог ({count("aiDrafted")})</ToggleGroup.Item>
              <ToggleGroup.Item value="approved">Батлагдсан ({count("approved")})</ToggleGroup.Item>
              <ToggleGroup.Item value="waiting">Хүлээгдэж буй ({count("submitted", "queued", "failed")})</ToggleGroup.Item>
            </ToggleGroup>
            <div className="edureport:flex edureport:max-h-[32rem] edureport:flex-col edureport:gap-1.5 edureport:overflow-y-auto">
              {rows.map((submission) => {
                const student = studentById.get(submission.studentId);
                const status = SUBMISSION_STATUS[submission.status];

                return (
                  <button
                    key={submission._id}
                    type="button"
                    onClick={() => setSelectedId(submission._id)}
                    className={cn(
                      "edureport:flex edureport:flex-col edureport:gap-1 edureport:rounded-md edureport:border edureport:p-2.5 edureport:text-left",
                      submission._id === selected?._id
                        ? "edureport:border-primary edureport:bg-accent"
                        : "edureport:border-border edureport:hover:bg-accent",
                    )}
                  >
                    <span className="edureport:flex edureport:items-center edureport:justify-between edureport:gap-2">
                      <span className="edureport:font-mono edureport:text-xs edureport:text-muted-foreground">
                        {student?.code ?? "—"}
                      </span>
                      <Badge variant={status.variant}>
                        {submission.status === "approved" ? `${submission.score} оноо` : status.label}
                      </Badge>
                    </span>
                    <span className="edureport:text-sm edureport:font-medium">{student?.name ?? "Тодорхойгүй сурагч"}</span>
                  </button>
                );
              })}
              {!rows.length && (
                <span className="edureport:py-4 edureport:text-center edureport:text-sm edureport:text-muted-foreground">
                  Тохирох эссэ алга
                </span>
              )}
            </div>
          </Panel>

          <Panel title={author ? `${author.name} · ${author.code}` : "Эссэ"} icon={IconFileText}>
            {detail.error ? (
              <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
            ) : !essay ? (
              <LoadingBlock rows={8} />
            ) : (
              <>
                <div className="edureport:flex edureport:flex-wrap edureport:items-center edureport:gap-2">
                  <Badge variant={SUBMISSION_STATUS[essay.status].variant}>{SUBMISSION_STATUS[essay.status].label}</Badge>
                  {essay.status === "approved" && (
                    <span className="edureport:text-xs edureport:text-muted-foreground">
                      {essay.score} / {assignment.maxScore} · {formatDateTime(essay.approvedAt)}
                    </span>
                  )}
                  {essay.text && (
                    <span className="edureport:text-xs edureport:text-muted-foreground">
                      {essay.text.split(/\s+/).filter(Boolean).length} үг
                    </span>
                  )}
                </div>
                {essay.error && <p className="edureport:text-sm edureport:text-destructive">AI алдаа: {essay.error}</p>}
                <p className="edureport:whitespace-pre-wrap edureport:text-sm edureport:leading-relaxed">
                  {essay.text || "Текст алга"}
                </p>
              </>
            )}
          </Panel>

          <div className="edureport:flex edureport:flex-col edureport:gap-4">
            <Panel title="AI ноорог санал хүсэлт" icon={IconSparkles}>
              {!essay ? (
                <LoadingBlock rows={4} />
              ) : !essay.aiDraft ? (
                <p className="edureport:text-sm edureport:text-muted-foreground">
                  {essay.status === "queued"
                    ? "AI ноорог боловсруулагдаж байна."
                    : "AI ноорог алга. Дээрх «AI санал хүсэлт үүсгэх»-ийг дарна уу."}
                </p>
              ) : (
                <div className="edureport:flex edureport:flex-col edureport:gap-3">
                  {essay.aiDraft.criteria.map((criterion) => (
                    <div
                      key={criterion.criterionKey}
                      className="edureport:flex edureport:flex-col edureport:gap-1.5 edureport:rounded-md edureport:border edureport:border-border edureport:p-3"
                    >
                      <span className="edureport:text-sm edureport:font-semibold">
                        {titles.get(criterion.criterionKey) ?? criterion.criterionKey}
                      </span>
                      {criterion.strengths.map((line) => (
                        <span key={line} className="edureport:flex edureport:gap-1.5 edureport:text-sm">
                          <IconCheck className="edureport:mt-0.5 edureport:size-4 edureport:shrink-0 edureport:text-success" />
                          {line}
                        </span>
                      ))}
                      {criterion.improvements.map((line) => (
                        <span key={line} className="edureport:flex edureport:gap-1.5 edureport:text-sm">
                          <IconArrowRight className="edureport:mt-0.5 edureport:size-4 edureport:shrink-0 edureport:text-warning" />
                          {line}
                        </span>
                      ))}
                      {criterion.evidenceQuote && (
                        <blockquote className="edureport:flex edureport:gap-1.5 edureport:rounded edureport:bg-muted edureport:p-2 edureport:text-xs edureport:italic">
                          <IconQuote className="edureport:size-3.5 edureport:shrink-0" />
                          {criterion.evidenceQuote}
                        </blockquote>
                      )}
                    </div>
                  ))}
                  <span className="edureport:text-xs edureport:text-muted-foreground">
                    {essay.aiDraft.model} · {formatDateTime(essay.aiDraft.generatedAt)} · AI оноо өгөхгүй
                  </span>
                </div>
              )}
            </Panel>
            <Panel title="Баталгаажуулах" icon={IconCircleCheck}>
              {essay ? (
                <ApprovePanel key={essay._id} detail={essay} maxScore={assignment.maxScore} titles={titles} />
              ) : (
                <LoadingBlock rows={3} />
              )}
            </Panel>
          </div>
        </div>
      )}

      <SubmissionsAddDialog classId={classId} assignmentId={assignment._id} open={adding} onOpenChange={setAdding} />
    </div>
  );
};
