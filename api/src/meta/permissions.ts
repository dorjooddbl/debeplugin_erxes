import type { IPermissionConfig } from "erxes-api-shared/core-types";
import { manifest } from "../config.ts";

// Permission config for edureport: docs/SPEC.md §4. checkPermission only
// answers allowed/denied, so "all classes" is the classesViewAll action
// rather than a scope the resolvers read.
const plugin = manifest.ui.name;
const moduleName = "edureport";

const actions = [
  { name: "showClasses", title: "Харах", always: true },
  { name: "classesViewAll", title: "Бүх багшийн ангийг харах, засах" },
  { name: "classesManage", title: "Анги, сурагч" },
  { name: "attendanceMark", title: "Ирц тэмдэглэх" },
  { name: "assignmentsManage", title: "Шалгуур, даалгавар, эссэ оруулах" },
  { name: "feedbackGenerate", title: "AI санал хүсэлт эхлүүлэх" },
  { name: "submissionsApprove", title: "Оноо тавих, батлах" },
  { name: "reportsManage", title: "Тайлан үүсгэх, засах" },
  { name: "reportsApprove", title: "Тайлан батлах" },
];

const actionNames = actions.map(({ name }) => name);

export const permissions: IPermissionConfig = {
  plugin,
  modules: [
    {
      name: moduleName,
      description: "EduReport",
      scopeField: null,
      ownerFields: ["teacherId"],
      scopes: [
        { name: "own", description: "Өөрийн ангиуд" },
        { name: "all", description: "Бүх анги" },
      ],
      actions: actions.map((action) => ({ ...action, description: action.title })),
    },
  ],
  defaultGroups: [
    {
      id: `${plugin}:teacher`,
      name: "EduReport багш",
      description: "Өөрийн ангиуд дээрх бүх үйлдэл",
      permissions: [
        {
          plugin,
          module: moduleName,
          actions: actionNames.filter((name) => name !== "classesViewAll"),
          scope: "own",
        },
      ],
    },
    {
      id: `${plugin}:admin`,
      name: "EduReport админ",
      description: "Бүх ангийн бүх үйлдэл",
      permissions: [{ plugin, module: moduleName, actions: actionNames, scope: "all" }],
    },
  ],
};
