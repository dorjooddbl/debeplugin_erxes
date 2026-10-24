import type { ComponentType, ReactNode } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";
import { Alert, Button, Empty, Skeleton } from "erxes-ui";

// Loading, error and empty states every query shows (AGENTS.md).

export const LoadingBlock = ({ rows = 4 }: { rows?: number }) => (
  <div className="edureport:flex edureport:flex-col edureport:gap-2" role="status" aria-label="Ачаалж байна">
    {Array.from({ length: rows }, (_value, i) => (
      <Skeleton key={i} className="edureport:h-8 edureport:w-full" />
    ))}
  </div>
);

export const ErrorState = ({
  title = "Ачаалж чадсангүй",
  error,
  onRetry,
}: {
  title?: string;
  error: { message: string };
  onRetry?: () => void;
}) => (
  <Alert variant="destructive">
    <IconAlertTriangle className="edureport:size-4" />
    <Alert.Title>{title}</Alert.Title>
    <Alert.Description className="edureport:flex edureport:flex-wrap edureport:items-center edureport:gap-2">
      <span>{error.message}</span>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={() => onRetry()}>
          Дахин оролдох
        </Button>
      )}
    </Alert.Description>
  </Alert>
);

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children?: ReactNode;
}) => (
  <Empty>
    <Empty.Header>
      <Empty.Media variant="icon">
        <Icon />
      </Empty.Media>
      <Empty.Title>{title}</Empty.Title>
      {description && <Empty.Description>{description}</Empty.Description>}
    </Empty.Header>
    {children && <Empty.Content>{children}</Empty.Content>}
  </Empty>
);

// A metric tile: the value, or a skeleton / dash while it loads or fails.
export const StatCard = ({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  failed,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ComponentType<{ className?: string }>;
  loading?: boolean;
  failed?: boolean;
}) => (
  <div className="edureport:flex edureport:flex-col edureport:gap-3 edureport:rounded-lg edureport:border edureport:border-border edureport:bg-background edureport:p-4 edureport:shadow-xs">
    <div className="edureport:flex edureport:items-center edureport:justify-between edureport:gap-2">
      <span className="edureport:text-xs edureport:font-medium edureport:uppercase edureport:text-muted-foreground">
        {label}
      </span>
      <span className="edureport:flex edureport:size-7 edureport:items-center edureport:justify-center edureport:rounded-md edureport:bg-accent">
        <Icon className="edureport:size-4 edureport:text-primary" />
      </span>
    </div>
    {loading ? (
      <Skeleton className="edureport:h-7 edureport:w-20" />
    ) : (
      <span className="edureport:text-2xl edureport:font-semibold">{failed ? "—" : value}</span>
    )}
    {hint && <span className="edureport:text-xs edureport:text-muted-foreground">{hint}</span>}
  </div>
);
