import type { ComponentType, ReactNode } from "react";
// Root imports on purpose: core-ui shares `erxes-ui`/`ui-modules` as Module
// Federation singletons keyed on the bare specifier, so deep imports would
// bundle second private copies instead of reusing the host's.
import { Breadcrumb, Button, Separator } from "erxes-ui";
import { PageHeader } from "ui-modules";
import { Link } from "react-router";
import manifest from "../../../erxes.json" with { type: "json" };

const { path } = manifest.ui;

// Header and scrolling body shared by every EduReport page, in the template's
// PageHeader + Breadcrumb layout.
export const PageShell = ({
  title,
  icon: Icon,
  iconName,
  to,
  actions,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  // Tabler icon name the host shows for the favorite.
  iconName: string;
  // Path under the plugin root, e.g. "classes".
  to: string;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <div className="edureport:flex edureport:h-full edureport:flex-col">
    <PageHeader>
      <PageHeader.Start>
        <Breadcrumb>
          <Breadcrumb.List className="edureport:gap-1">
            <Breadcrumb.Item>
              <Button variant="ghost" asChild>
                <Link to={`/${path}/${to}`}>
                  <Icon />
                  {title}
                </Link>
              </Button>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb>
        <Separator.Inline />
        <PageHeader.FavoriteToggleButton breadcrumb={[manifest.title, title]} icon={iconName} />
      </PageHeader.Start>
      {actions && <PageHeader.End>{actions}</PageHeader.End>}
    </PageHeader>
    <div className="edureport:flex-1 edureport:overflow-auto">
      <div className="edureport:mx-auto edureport:flex edureport:w-full edureport:max-w-7xl edureport:flex-col edureport:gap-4 edureport:p-6">
        {children}
      </div>
    </div>
  </div>
);
