import { useMutation } from "@apollo/client";
import { useState } from "react";
import { IconCircleCheck, IconWand } from "@tabler/icons-react";
import { Button, Input, Label, Textarea, toast } from "erxes-ui";
import { SUBMISSION_APPROVE } from "../../graphql/essays";
import type { EdureportSubmissionDetailQuery } from "../../gql/graphql";

type Detail = EdureportSubmissionDetailQuery["edureportSubmissionDetail"];

// The AI draft as editable text, one block per criterion. The teacher edits
// it; nothing here suggests a score.
const fromDraft = (draft: NonNullable<Detail["aiDraft"]>, titles: Map<string, string>) =>
  draft.criteria
    .map((criterion) =>
      [
        `${titles.get(criterion.criterionKey) ?? criterion.criterionKey}:`,
        ...criterion.strengths.map((line) => `+ ${line}`),
        ...criterion.improvements.map((line) => `→ ${line}`),
      ].join("\n"),
    )
    .join("\n\n");

// Teacher feedback and score, then approve (docs/SPEC.md §5). The score is
// typed by the teacher only; AI never provides one.
export const ApprovePanel = ({
  detail,
  maxScore,
  titles,
}: {
  detail: Detail;
  maxScore: number;
  titles: Map<string, string>;
}) => {
  const [feedback, setFeedback] = useState(detail.teacherFeedback ?? "");
  const [score, setScore] = useState(detail.score?.toString() ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [approve, { loading }] = useMutation(SUBMISSION_APPROVE, {
    refetchQueries: ["edureportSubmissionList", "edureportSubmissionDetail"],
    awaitRefetchQueries: true,
  });

  const queued = detail.status === "queued";

  const submit = async () => {
    setProblem(null);

    const value = Number(score);

    if (!feedback.trim()) {
      setProblem("Санал хүсэлтийг бичнэ үү");

      return;
    }

    if (score.trim() === "" || !Number.isFinite(value) || value < 0 || value > maxScore) {
      setProblem(`Оноо 0-ээс ${maxScore} хооронд байна`);

      return;
    }

    try {
      await approve({ variables: { _id: detail._id, teacherFeedback: feedback.trim(), score: value } });
      toast({ title: "Баталгаажлаа", variant: "success" });
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="edureport:flex edureport:flex-col edureport:gap-3">
      <div className="edureport:flex edureport:items-center edureport:justify-between edureport:gap-2">
        <Label htmlFor="teacher-feedback">Багшийн санал хүсэлт</Label>
        {detail.aiDraft && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => detail.aiDraft && setFeedback(fromDraft(detail.aiDraft, titles))}
          >
            <IconWand />
            Ноорогоос бөглөх
          </Button>
        )}
      </div>
      <Textarea
        id="teacher-feedback"
        rows={8}
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        placeholder="Сурагчид өгөх санал хүсэлт"
      />
      <div className="edureport:flex edureport:items-end edureport:gap-3">
        <div className="edureport:flex edureport:flex-col edureport:gap-1.5">
          <Label htmlFor="teacher-score">Оноо (багш тавина)</Label>
          <div className="edureport:flex edureport:items-center edureport:gap-1.5">
            <Input
              id="teacher-score"
              inputMode="decimal"
              className="edureport:w-24"
              value={score}
              onChange={(event) => setScore(event.target.value)}
            />
            <span className="edureport:text-sm edureport:text-muted-foreground">/ {maxScore}</span>
          </div>
        </div>
        <Button className="edureport:ml-auto" onClick={submit} disabled={loading || queued}>
          <IconCircleCheck />
          {loading ? "Хадгалж байна…" : detail.status === "approved" ? "Дахин батлах" : "Баталгаажуулах"}
        </Button>
      </div>
      {queued && <p className="edureport:text-sm edureport:text-muted-foreground">AI ноорог боловсруулагдаж байна.</p>}
      {problem && <p className="edureport:text-sm edureport:text-destructive">{problem}</p>}
    </div>
  );
};
