import { useState } from "react";
import { IconPlus, IconSchool } from "@tabler/icons-react";
import { Badge, Button, Skeleton, cn } from "erxes-ui";
import { ClassFormDialog } from "./ClassFormDialog";
import type { useCurrentClass } from "./useCurrentClass";
import { EmptyState, ErrorState } from "./states";

type CurrentClass = ReturnType<typeof useCurrentClass>;

// Class tabs on top of every page, with "add class". Renders the empty state
// itself when there is no class yet, so pages only handle `current`.
export const ClassBar = ({ classes, current, setClassId, loading, error, refetch }: CurrentClass) => {
  const [adding, setAdding] = useState(false);

  const dialog = (
    <ClassFormDialog open={adding} onOpenChange={setAdding} onSaved={(classId) => setClassId(classId)} />
  );

  if (loading && !classes.length) {
    return <Skeleton className="edureport:h-11 edureport:w-full" />;
  }

  if (error && !classes.length) {
    return <ErrorState title="Ангиудыг ачаалж чадсангүй" error={error} onRetry={() => refetch()} />;
  }

  if (!classes.length) {
    return (
      <>
        <EmptyState icon={IconSchool} title="Анги алга" description="Эхлээд анги үүсгээд сурагчдаа оруулна.">
          <Button onClick={() => setAdding(true)}>
            <IconPlus />
            Анги нэмэх
          </Button>
        </EmptyState>
        {dialog}
      </>
    );
  }

  return (
    <div className="edureport:flex edureport:flex-wrap edureport:items-center edureport:gap-2 edureport:rounded-lg edureport:border edureport:border-border edureport:bg-background edureport:p-1.5 edureport:shadow-xs">
      {classes.map((cls) => {
        const active = cls._id === current?._id;

        return (
          <button
            key={cls._id}
            type="button"
            onClick={() => setClassId(cls._id)}
            aria-pressed={active}
            className={cn(
              "edureport:flex edureport:items-center edureport:gap-2 edureport:rounded-md edureport:px-3 edureport:py-1.5 edureport:text-sm edureport:font-medium edureport:transition-colors",
              active
                ? "edureport:bg-primary edureport:text-primary-foreground"
                : "edureport:text-muted-foreground edureport:hover:bg-accent edureport:hover:text-foreground",
            )}
          >
            <span>{cls.name}</span>
            <span className={cn("edureport:text-xs", active ? "edureport:opacity-80" : "edureport:opacity-70")}>
              {cls.subject}
            </span>
            <Badge variant={active ? "secondary" : "ghost"}>{cls.studentCount}</Badge>
          </button>
        );
      })}
      <Button variant="ghost" size="sm" className="edureport:ml-auto" onClick={() => setAdding(true)}>
        <IconPlus />
        Анги нэмэх
      </Button>
      {dialog}
    </div>
  );
};
