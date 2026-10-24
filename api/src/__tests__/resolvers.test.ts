import { resolvers } from "../apollo/resolvers/index.ts";
import type { IContext } from "../connectionResolvers.ts";
import { SPEC_MUTATIONS, SPEC_QUERIES } from "./helpers/spec.ts";

// `never` args: each resolver declares its own argument type.
type Resolver = (root: unknown, args: never, context: IContext) => Promise<unknown>;

const queries: Record<string, Resolver> = resolvers.Query;
const mutations: Record<string, Resolver> = resolvers.Mutation;

// Operations with a real body; the rest still answer "Хэрэгжээгүй байна".
const IMPLEMENTED = new Set([
  "edureportClassList",
  "edureportClassDetail",
  "edureportClassAdd",
  "edureportClassEdit",
  "edureportClassRemove",
  "edureportStudentList",
  "edureportStudentsImport",
  "edureportAttendanceList",
  "edureportAttendanceSummary",
  "edureportAttendanceMark",
  "edureportRubricList",
  "edureportRubricSave",
  "edureportAssignmentList",
  "edureportAssignmentAdd",
  "edureportScoresSet",
  "edureportSubmissionList",
  "edureportSubmissionDetail",
  "edureportSubmissionsAdd",
  "edureportSubmissionApprove",
  "edureportFeedbackGenerate",
  "edureportReportGenerate",
  "edureportReportDetail",
  "edureportReportList",
  "edureportReportEdit",
  "edureportReportApprove",
  "edureportJobStatus",
]);

const run = (resolver: Resolver | undefined, checkPermission: IContext["checkPermission"]) => {
  if (!resolver) {
    throw new Error("resolver is missing");
  }

  return resolver(undefined, {} as never, { checkPermission } as unknown as IContext);
};

describe.each([
  ["Query", queries, SPEC_QUERIES],
  ["Mutation", mutations, SPEC_MUTATIONS],
])("%s resolvers", (_root, map, spec) => {
  it("match the SPEC §5 operations one to one", () => {
    expect(Object.keys(map).sort()).toEqual(Object.keys(spec).sort());
  });

  it.each(Object.entries(spec))("%s checks %s before anything else", async (name, action) => {
    const denied = new Error("Permission required");
    const checkPermission = jest.fn<Promise<void>, [string]>().mockRejectedValue(denied);

    await expect(run(map[name], checkPermission)).rejects.toBe(denied);
    expect(checkPermission).toHaveBeenCalledTimes(1);
    expect(checkPermission).toHaveBeenCalledWith(action);
  });

  const notYet = Object.keys(spec).filter((name) => !IMPLEMENTED.has(name));

  if (notYet.length > 0) {
    it.each(notYet)(
      "%s is not implemented yet",
      async (name) => {
        const checkPermission = jest.fn<Promise<void>, [string]>().mockResolvedValue();

        await expect(run(map[name], checkPermission)).rejects.toThrow("Хэрэгжээгүй байна");
      },
    );
  }
});
