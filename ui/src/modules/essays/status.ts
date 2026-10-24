import type { EdureportSubmissionStatus } from "../../gql/graphql";

type BadgeVariant = "default" | "secondary" | "warning" | "success" | "info" | "destructive";

export const SUBMISSION_STATUS: Record<EdureportSubmissionStatus, { label: string; variant: BadgeVariant }> = {
  submitted: { label: "Ирсэн", variant: "secondary" },
  queued: { label: "AI боловсруулж байна", variant: "warning" },
  aiDrafted: { label: "AI ноорог бэлэн", variant: "info" },
  failed: { label: "Алдаатай", variant: "destructive" },
  approved: { label: "Батлагдсан", variant: "success" },
};
