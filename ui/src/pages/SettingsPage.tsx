import { IconAdjustments, IconSchool, IconSettings } from "@tabler/icons-react";
import { Breadcrumb, Button, Card, Empty, Separator } from "erxes-ui";
import { PageHeader } from "ui-modules";
import { Link } from "react-router";
import manifest from "../../../erxes.json" with { type: "json" };

const { path } = manifest.ui;

const IDENTITY: [string, string][] = [
  ["Нэр", manifest.name],
  ["Зам", `/${path}`],
  ["Remote", manifest.ui.remote],
  ["API", `:${manifest.api.port}${manifest.api.graphql}`],
  ["Хувилбар", manifest.version],
];

export const SettingsPage = () => (
  <div className="edureport:flex edureport:h-full edureport:flex-col">
    <PageHeader>
      <PageHeader.Start>
        <Breadcrumb>
          <Breadcrumb.List className="edureport:gap-1">
            <Breadcrumb.Item>
              <Button variant="ghost" asChild>
                <Link to={`/${path}/settings`}>
                  <IconSettings />
                  {manifest.title} тохиргоо
                </Link>
              </Button>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb>
        <Separator.Inline />
        <PageHeader.FavoriteToggleButton
          breadcrumb={[manifest.title, "Тохиргоо"]}
          icon="IconSettings"
        />
      </PageHeader.Start>
      <PageHeader.End>
        <Button variant="outline" asChild>
          <Link to={`/${path}`}>
            <IconSchool />
            {manifest.title} руу буцах
          </Link>
        </Button>
      </PageHeader.End>
    </PageHeader>
    <div className="edureport:flex-1 edureport:overflow-auto">
      <div className="edureport:mx-auto edureport:flex edureport:w-full edureport:max-w-3xl edureport:flex-col edureport:gap-6 edureport:p-6">
        <Card>
          <Card.Header>
            <Card.Title>Ерөнхий</Card.Title>
            <Card.Description>
              Плагины мэдээлэл erxes.json-оос ирнэ; тэнд өөрчлөөд дахин
              эхлүүлнэ.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <dl className="edureport:grid edureport:grid-cols-[8rem_1fr] edureport:gap-y-2 edureport:text-sm">
              {IDENTITY.map(([label, value]) => (
                <div
                  key={label}
                  className="edureport:contents"
                >
                  <dt className="edureport:text-muted-foreground">{label}</dt>
                  <dd>
                    <code className="edureport:rounded edureport:bg-muted edureport:px-1.5 edureport:py-0.5 edureport:font-mono edureport:text-xs">
                      {value}
                    </code>
                  </dd>
                </div>
              ))}
            </dl>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title>Тохиргоо</Card.Title>
            <Card.Description>
              Ангийн анхаарах босгыг «Анги, сурагчид» хуудасны «Засах»-аас
              тохируулна.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <Empty>
              <Empty.Header>
                <Empty.Media variant="icon">
                  <IconAdjustments />
                </Empty.Media>
                <Empty.Title>Нэмэлт тохиргоо алга</Empty.Title>
                <Empty.Description>
                  Плагины бусад тохиргоо одоогоор шаардлагагүй.
                </Empty.Description>
              </Empty.Header>
            </Empty>
          </Card.Content>
        </Card>
      </div>
    </div>
  </div>
);
