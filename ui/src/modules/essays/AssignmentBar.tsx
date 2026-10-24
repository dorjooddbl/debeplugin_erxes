import { useState } from "react";
import { IconClipboardList, IconPlus } from "@tabler/icons-react";
import { Badge, Button, Skeleton, cn } from "erxes-ui";
import type { EdureportAssignmentListQuery } from "../../gql/graphql";
import { EmptyState } from "../states";
import { AssignmentFormDialog } from "./AssignmentFormDialog";

type Assignment = EdureportAssignmentListQuery["edureportAssignmentList"][number];

export const KIND_LABEL = { essay: "Эссэ", task: "Даалгавар" } as const;

// Assignment tabs for the selected class, with "add assignment".
export const AssignmentBar = ({
  classId,
  assignments,
  loading,
  selectedId,
  onSelect,
}: {
  classId: string;
  assignments: Assignment[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (assignmentId: string) => void;
}) => {
  const [adding, setAdding] = useState(false);
  const dialog = (
    <AssignmentFormDialog classId={classId} open={adding} onOpenChange={setAdding} onSaved={onSelect} />
  );

  if (loading && !assignments.length) {
    return <Skeleton className="edureport:h-11 edureport:w-full" />;
  }

  if (!assignments.length) {
    return (
      <>
        <EmptyState
          icon={IconClipboardList}
          title="Даалгавар алга"
          description="Эссэ эсвэл энгийн даалгавар нэмээд эхэлнэ."
        >
          <Button onClick={() => setAdding(true)}>
            <IconPlus />
            Даалгавар нэмэх
          </Button>
        </EmptyState>
        {dialog}
      </>
    );
  }

  return (
    <div className="edureport:flex edureport:flex-wrap edureport:items-center edureport:gap-2 edureport:rounded-lg edureport:border edureport:border-border edureport:bg-background edureport:p-1.5 edureport:shadow-xs">
      {assignments.map((assignment) => {
        const active = assignment._id === selectedId;

        return (
          <button
            key={assignment._id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(assignment._id)}
            className={cn(
              "edureport:flex edureport:items-center edureport:gap-2 edureport:rounded-md edureport:px-3 edureport:py-1.5 edureport:text-sm edureport:font-medium",
              active
                ? "edureport:bg-primary edureport:text-primary-foreground"
                : "edureport:text-muted-foreground edureport:hover:bg-accent edureport:hover:text-foreground",
            )}
          >
            <Badge variant={active ? "secondary" : assignment.kind === "essay" ? "info" : "secondary"}>
              {KIND_LABEL[assignment.kind]}
            </Badge>
            <span className="edureport:max-w-64 edureport:truncate">{assignment.title}</span>
          </button>
        );
      })}
      <Button variant="ghost" size="sm" className="edureport:ml-auto" onClick={() => setAdding(true)}>
        <IconPlus />
        Даалгавар нэмэх
      </Button>
      {dialog}
    </div>
  );
};
