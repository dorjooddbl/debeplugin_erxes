import { useApolloClient, useMutation, useQuery } from "@apollo/client";
import { useEffect, useState } from "react";
import { IconSparkles } from "@tabler/icons-react";
import { Button, toast } from "erxes-ui";
import { FEEDBACK_GENERATE, JOB_STATUS } from "../../graphql/essays";
import { ErrorState } from "../states";

const POLL_MS = 2000;

// Starts AI feedback for every submitted (and failed or stuck) essay of the
// assignment and follows the job until it finishes. AI writes drafts only;
// it never writes a score.
export const FeedbackBanner = ({ assignmentId, pending }: { assignmentId: string; pending: number }) => {
  const client = useApolloClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [generate, generating] = useMutation(FEEDBACK_GENERATE);

  const job = useQuery(JOB_STATUS, {
    variables: { jobId: jobId ?? "" },
    skip: !jobId,
    pollInterval: POLL_MS,
    notifyOnNetworkStatusChange: false,
  });
  const progress = job.data?.edureportJobStatus;

  useEffect(() => {
    if (progress?.finished) {
      job.stopPolling();
      client.refetchQueries({ include: ["edureportSubmissionList", "edureportSubmissionDetail"] });
    }
  }, [progress?.finished, job, client]);

  const start = async () => {
    try {
      const { data } = await generate({ variables: { assignmentId } });
      const result = data?.edureportFeedbackGenerate;

      if (!result) {
        return;
      }

      if (!result.queued) {
        toast({ title: "Дараалалд оруулах эссэ алга", variant: "warning" });

        return;
      }

      setJobId(result.jobId);
      client.refetchQueries({ include: ["edureportSubmissionList"] });
    } catch {
      // Shown below through generating.error.
    }
  };

  const total = progress?.total ?? 0;
  const done = progress?.done ?? 0;
  const failed = progress?.failed ?? 0;
  const running = Boolean(jobId) && !progress?.finished;

  return (
    <div className="edureport:flex edureport:flex-col edureport:gap-3 edureport:rounded-lg edureport:border edureport:border-border edureport:bg-accent/40 edureport:p-4">
      <div className="edureport:flex edureport:flex-wrap edureport:items-center edureport:gap-3">
        <span className="edureport:flex edureport:size-8 edureport:items-center edureport:justify-center edureport:rounded-md edureport:bg-background">
          <IconSparkles className="edureport:size-4 edureport:text-primary" />
        </span>
        <div className="edureport:flex edureport:flex-col">
          <span className="edureport:text-sm edureport:font-medium">AI санал хүсэлтийн ноорог</span>
          <span className="edureport:text-xs edureport:text-muted-foreground">
            {running
              ? `${done + failed} / ${total} боловсруулсан`
              : progress?.finished
                ? `Дууслаа: ${done} бэлэн${failed ? `, ${failed} алдаатай` : ""}`
                : `${pending} эссэ ноорог хүлээж байна · AI оноо өгөхгүй, оноог багш тавина`}
          </span>
        </div>
        <Button className="edureport:ml-auto" onClick={start} disabled={generating.loading || running || !pending}>
          <IconSparkles />
          {generating.loading ? "Эхлүүлж байна…" : "AI санал хүсэлт үүсгэх"}
        </Button>
      </div>
      {jobId && total > 0 && (
        <div className="edureport:h-1.5 edureport:overflow-hidden edureport:rounded-full edureport:bg-muted">
          <div
            className="edureport:h-full edureport:rounded-full edureport:bg-primary edureport:transition-all"
            style={{ width: `${Math.round(((done + failed) / total) * 100)}%` }}
          />
        </div>
      )}
      {generating.error && <ErrorState title="AI санал хүсэлт эхэлсэнгүй" error={generating.error} />}
      {job.error && <ErrorState title="Явцыг уншиж чадсангүй" error={job.error} onRetry={() => job.refetch()} />}
    </div>
  );
};
