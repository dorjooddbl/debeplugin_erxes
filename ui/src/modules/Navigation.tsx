import { IconSchool, IconSettings } from "@tabler/icons-react";
// Root import on purpose: core-ui shares `erxes-ui` as a Module Federation
// singleton keyed on the bare specifier, so deep imports would bundle a second
// private copy instead of reusing the host's.
import { NavigationMenuLinkItem, Sidebar } from "erxes-ui";
import manifest from "../../../erxes.json" with { type: "json" };

const root = `/${manifest.ui.path}`;

export const Navigation = () => (
  <Sidebar.Group>
    <Sidebar.GroupLabel>Цэс ба модулиуд</Sidebar.GroupLabel>
    <Sidebar.GroupContent>
      <Sidebar.Menu>
        <NavigationMenuLinkItem name="Анги, сурагчид" icon={IconSchool} path={`${root}/classes`} />
        <NavigationMenuLinkItem name="Тохиргоо" icon={IconSettings} path={`${root}/settings`} />
      </Sidebar.Menu>
    </Sidebar.GroupContent>
  </Sidebar.Group>
);
