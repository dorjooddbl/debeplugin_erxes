import "./styles.css";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import { AppLayout } from "erxes-ui";
import manifest from "../../erxes.json" with { type: "json" };
import { Navigation } from "./modules/Navigation";

const ClassesPage = lazy(() =>
  import("./pages/ClassesPage").then((module) => ({ default: module.ClassesPage })),
);
const AttendancePage = lazy(() =>
  import("./pages/AttendancePage").then((module) => ({ default: module.AttendancePage })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })),
);

// core-ui mounts this component at `/<path>/*`; routes below are relative to
// it. It resolves the component by the PascalCase expose name. Each module
// has its own path: the sidebar marks an item active by path prefix, so the
// plugin root only redirects.
export const Edureport = () => (
  <AppLayout id={manifest.name} title={manifest.title} sidebar={<Navigation />}>
    <Suspense fallback={<div role="status">Ачаалж байна…</div>}>
      <Routes>
        <Route index element={<Navigate to="classes" replace />} />
        <Route path="classes" element={<ClassesPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Routes>
    </Suspense>
  </AppLayout>
);
