import { useQuery } from "@apollo/client";
import type { ComponentType, ReactNode } from "react";
import {
  IconBook,
  IconDatabase,
  IconExternalLink,
  IconLayoutDashboard,
  IconSandbox,
  IconSettings,
} from "@tabler/icons-react";
// Root imports on purpose: core-ui shares `erxes-ui`/`ui-modules` as Module
// Federation singletons keyed on the bare specifier, so deep imports would
// bundle second private copies instead of reusing the host's.
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  Separator,
  Skeleton,
  cn,
} from "erxes-ui";
import { PageHeader } from "ui-modules";
import { Link } from "react-router";
import manifest from "../../../erxes.json" with { type: "json" };
import { CLASS_COUNT_QUERY } from "../graphql";

const { path } = manifest.ui;

const Dot = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "edureport:inline-block edureport:size-2 edureport:rounded-full",
      className,
    )}
  />
);

const StatusRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="edureport:flex edureport:items-center edureport:justify-between edureport:gap-4 edureport:text-sm">
    <span className="edureport:text-muted-foreground">{label}</span>
    <span className="edureport:flex edureport:items-center edureport:gap-2 edureport:font-medium">
      {children}
    </span>
  </div>
);

const ConnectionCard = () => {
  const { data, loading, error, refetch } = useQuery(CLASS_COUNT_QUERY);

  const pending = (
    <>
      <Dot className="edureport:animate-pulse edureport:bg-muted-foreground" />
      <Skeleton className="edureport:h-4 edureport:w-24" />
    </>
  );

  return (
    <Card className="edureport:w-full edureport:md:w-80 edureport:shrink-0">
      <Card.Header>
        <Card.Title className="edureport:text-sm">Connection</Card.Title>
        <Card.Description>
          Live status of this plugin inside erxes
        </Card.Description>
      </Card.Header>
      <Card.Content className="edureport:flex edureport:flex-col edureport:gap-3">
        <StatusRow label="API">
          {loading ? (
            pending
          ) : error ? (
            <>
              <Dot className="edureport:bg-destructive" />
              <span>Error</span>
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </>
          ) : (
            <>
              <Dot className="edureport:bg-success" />
              <span>
                Connected · {data?.edureportClassList.totalCount ?? 0} classes · v
                {manifest.version}
              </span>
            </>
          )}
        </StatusRow>
        <StatusRow label="Gateway">
          {loading ? (
            pending
          ) : error ? (
            <>
              <Dot className="edureport:bg-destructive" />
              <span
                className="edureport:truncate edureport:max-w-40"
                title={error.message}
              >
                {error.message}
              </span>
            </>
          ) : (
            <>
              <Dot className="edureport:bg-success" />
              <span>Federated as {manifest.name}</span>
            </>
          )}
        </StatusRow>
      </Card.Content>
    </Card>
  );
};

const StepCard = ({
  icon: Icon,
  title,
  description,
  code,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  code: string;
}) => (
  <Card>
    <Card.Header>
      <div className="edureport:flex edureport:size-9 edureport:items-center edureport:justify-center edureport:rounded-lg edureport:bg-accent">
        <Icon className="edureport:size-5" />
      </div>
      <Card.Title>{title}</Card.Title>
      <Card.Description>{description}</Card.Description>
    </Card.Header>
    <Card.Content>
      <code className="edureport:rounded edureport:bg-muted edureport:px-1.5 edureport:py-0.5 edureport:font-mono edureport:text-xs">
        {code}
      </code>
    </Card.Content>
  </Card>
);

const STEPS = [
  {
    icon: IconDatabase,
    title: "Model your data",
    description:
      "Define the records this plugin owns and expose them on the federated graph.",
    code: "api/src/modules/edureport",
  },
  {
    icon: IconLayoutDashboard,
    title: "Build the page",
    description:
      "Replace this overview with your module: lists with RecordTable, forms with Form, details in a Sheet.",
    code: "ui/src/pages/IndexPage.tsx",
  },
];

export const IndexPage = () => (
  <div className="edureport:flex edureport:h-full edureport:flex-col">
    <PageHeader>
      <PageHeader.Start>
        <Breadcrumb>
          <Breadcrumb.List className="edureport:gap-1">
            <Breadcrumb.Item>
              <Button variant="ghost" asChild>
                <Link to={`/${path}`}>
                  <IconSandbox />
                  {manifest.title}
                </Link>
              </Button>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb>
        <Separator.Inline />
        <PageHeader.FavoriteToggleButton
          breadcrumb={[manifest.title]}
          icon="IconSandbox"
        />
      </PageHeader.Start>
      <PageHeader.End>
        <Button variant="outline" asChild>
          <Link to={`/${path}/settings`}>
            <IconSettings />
            Settings
          </Link>
        </Button>
      </PageHeader.End>
    </PageHeader>
    <div className="edureport:flex-1 edureport:overflow-auto">
      <div className="edureport:mx-auto edureport:flex edureport:w-full edureport:max-w-5xl edureport:flex-col edureport:gap-6 edureport:p-6">
        <section className="edureport:relative edureport:overflow-hidden edureport:rounded-xl edureport:border edureport:border-border edureport:bg-background edureport:p-8 edureport:shadow-xs">
          <div
            aria-hidden
            className="edureport:pointer-events-none edureport:absolute edureport:inset-0 edureport:bg-gradient-to-br edureport:from-primary/10 edureport:via-transparent edureport:to-transparent"
          />
          <div className="edureport:relative edureport:flex edureport:flex-col edureport:gap-6 edureport:md:flex-row edureport:md:items-start edureport:md:justify-between">
            <div className="edureport:flex edureport:max-w-xl edureport:flex-col edureport:gap-4">
              <div>
                <Badge variant="info">Plugin · v{manifest.version}</Badge>
              </div>
              <h1 className="edureport:text-2xl edureport:font-semibold edureport:tracking-tight">
                Welcome to {manifest.title}
              </h1>
              <p className="edureport:text-sm edureport:leading-relaxed edureport:text-muted-foreground">
                {manifest.description}
              </p>
              <div className="edureport:flex edureport:flex-wrap edureport:gap-2">
                <Button asChild>
                  <Link to={`/${path}/settings`}>
                    <IconSettings />
                    Open settings
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href="https://erxes.io/docs/create-plugin-standalone"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <IconBook />
                    Developer guide
                    <IconExternalLink />
                  </a>
                </Button>
              </div>
            </div>
            <ConnectionCard />
          </div>
        </section>
        <div className="edureport:grid edureport:gap-4 edureport:md:grid-cols-2">
          {STEPS.map((step) => (
            <StepCard key={step.title} {...step} />
          ))}
        </div>
      </div>
    </div>
  </div>
);
