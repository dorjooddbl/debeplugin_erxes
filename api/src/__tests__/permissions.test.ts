import { permissions } from "../meta/permissions.ts";
import { SPEC_ACTIONS, SPEC_MUTATIONS, SPEC_QUERIES } from "./helpers/spec.ts";

describe("permissions (SPEC §4)", () => {
  const [module] = permissions.modules;

  it("declares one edureport module owned through teacherId", () => {
    expect(permissions.plugin).toBe("edureport");
    expect(permissions.modules).toHaveLength(1);
    expect(module?.name).toBe("edureport");
    expect(module?.ownerFields).toEqual(["teacherId"]);
    expect(module?.scopes.map(({ name }) => name)).toEqual(["own", "all"]);
  });

  it("declares exactly the SPEC actions, with showClasses always granted", () => {
    expect(module?.actions.map(({ name }) => name)).toEqual(SPEC_ACTIONS);
    expect(module?.actions.filter(({ always }) => always).map(({ name }) => name)).toEqual([
      "showClasses",
    ]);
  });

  it("declares every action an operation checks", () => {
    const used = new Set([...Object.values(SPEC_QUERIES), ...Object.values(SPEC_MUTATIONS)]);

    expect([...used].filter((action) => !SPEC_ACTIONS.includes(action))).toEqual([]);
  });

  it("gives teachers every action except classesViewAll, on their own classes", () => {
    const teacher = permissions.defaultGroups?.find(({ id }) => id === "edureport:teacher");

    expect(teacher?.permissions).toEqual([
      {
        plugin: "edureport",
        module: "edureport",
        actions: SPEC_ACTIONS.filter((action) => action !== "classesViewAll"),
        scope: "own",
      },
    ]);
  });

  it("gives admins every action on all classes", () => {
    const admin = permissions.defaultGroups?.find(({ id }) => id === "edureport:admin");

    expect(admin?.permissions).toEqual([
      { plugin: "edureport", module: "edureport", actions: SPEC_ACTIONS, scope: "all" },
    ]);
  });
});
