import { buildSubgraphSchema } from "@apollo/subgraph";
import { type GraphQLInputType, getNamedType, isInputObjectType } from "graphql";
import { resolvers } from "../apollo/resolvers/index.ts";
import { typeDefs } from "../apollo/typeDefs.ts";
import type {
  IAssignment,
  IClass,
  IRubric,
  IRubricCriterion,
  IStudent,
  ISubmission,
} from "../modules/edureport/@types/index.ts";
import { TEACHER_ACTIONS, contextFor, fakeModels } from "./helpers/fakeModels.ts";

// Step 5 resolvers (rubrics, assignments, scores, essays, approval) against
// in-memory models: docs/SPEC.md §4 access and §5 validation.

const { Query, Mutation } = resolvers;

const ALICE = { _id: "teacher-alice" };
const BOB = { _id: "teacher-bob" };
const OWNER = { _id: "owner", isOwner: true };
const VIEW_ALL = [...TEACHER_ACTIONS, "classesViewAll"];

const klass = (_id: string, teacherId: string): IClass & { _id: string } => ({
  _id,
  name: "7Б",
  subject: "Монгол хэл",
  term: "2026-2027 I улирал",
  teacherId,
});

const student = (_id: string, classId: string, code: string): IStudent & { _id: string } => ({
  _id,
  classId,
  name: `Сурагч ${code}`,
  code,
});

const clarity: IRubricCriterion = { key: "clarity", title: "Санааны тодорхой байдал", description: "", levels: [] };
const structure: IRubricCriterion = { key: "structure", title: "Бүтэц", description: "", levels: [] };
const criteria = [clarity, structure];

const rubric = (_id: string, teacherId: string): IRubric & { _id: string } => ({
  _id,
  name: "Эссэ бичлэг",
  teacherId,
  criteria,
});

const assignment = (_id: string, classId: string, kind: "task" | "essay"): IAssignment & { _id: string } => ({
  _id,
  classId,
  title: kind === "essay" ? "Миний зун" : "Шалгалт 1",
  kind,
  maxScore: 10,
  ...(kind === "essay" ? { rubricId: "alice-rubric" } : {}),
});

const submission = (_id: string, assignmentId: string, classId: string, studentId: string): ISubmission & { _id: string } => ({
  _id,
  assignmentId,
  classId,
  studentId,
  text: "Энэ зун би эмээ дээрээ очсон.",
  status: "submitted",
});

const school = () =>
  fakeModels({
    classes: [klass("alice-class", ALICE._id), klass("bob-class", BOB._id)],
    students: [
      student("s1", "alice-class", "S-001"),
      student("s2", "alice-class", "S-002"),
      student("bob-s1", "bob-class", "S-001"),
    ],
    rubrics: [rubric("alice-rubric", ALICE._id), rubric("bob-rubric", BOB._id)],
    assignments: [
      assignment("alice-essay", "alice-class", "essay"),
      assignment("alice-task", "alice-class", "task"),
      { ...assignment("bob-essay", "bob-class", "essay"), rubricId: "bob-rubric" },
    ],
    submissions: [
      submission("alice-sub", "alice-essay", "alice-class", "s1"),
      submission("bob-sub", "bob-essay", "bob-class", "bob-s1"),
    ],
  });

describe("rubrics", () => {
  it("lists the teacher's own rubrics, and every rubric for classesViewAll", async () => {
    const { models } = school();

    const own = await Query.edureportRubricList(undefined, {}, contextFor(models, ALICE));
    const all = await Query.edureportRubricList(undefined, {}, contextFor(models, BOB, VIEW_ALL));

    expect(own.map(({ _id }) => _id)).toEqual(["alice-rubric"]);
    expect(all.map(({ _id }) => _id).sort()).toEqual(["alice-rubric", "bob-rubric"]);
  });

  it("creates a rubric owned by the signed-in user", async () => {
    const { models } = school();

    const saved = await Mutation.edureportRubricSave(
      undefined,
      { name: "Уран зохиол", criteria },
      contextFor(models, BOB),
    );

    expect(saved).toMatchObject({ name: "Уран зохиол", teacherId: BOB._id });
  });

  it("edits only the user's own rubric, even for owners and classesViewAll", async () => {
    const { models, data } = school();
    const args = { _id: "alice-rubric", name: "Өөрчилсөн", criteria };

    for (const context of [contextFor(models, BOB), contextFor(models, BOB, VIEW_ALL), contextFor(models, OWNER)]) {
      await expect(Mutation.edureportRubricSave(undefined, args, context)).rejects.toThrow("Шалгуур олдсонгүй");
    }

    expect(data.rubrics.find(({ _id }) => _id === "alice-rubric")?.name).toBe("Эссэ бичлэг");

    await Mutation.edureportRubricSave(undefined, args, contextFor(models, ALICE));

    expect(data.rubrics.find(({ _id }) => _id === "alice-rubric")).toMatchObject({
      name: "Өөрчилсөн",
      teacherId: ALICE._id,
    });
  });

  it.each<[string, IRubricCriterion[], string]>([
    ["no criteria", [], "Шалгуур 1-ээс 8"],
    ["nine criteria", Array.from({ length: 9 }, (_c, i) => ({ ...clarity, key: `k${i}` })), "Шалгуур 1-ээс 8"],
    ["a repeated key", [clarity, { ...structure, key: "clarity" }], "давхардсан"],
    ["a blank key", [{ ...clarity, key: " " }], "Шалгуурын түлхүүр хоосон"],
    ["a blank title", [{ ...clarity, title: "" }], "Шалгуурын нэр хоосон"],
  ])("rejects %s", async (_case, bad, message) => {
    const { models, writes } = school();

    await expect(
      Mutation.edureportRubricSave(undefined, { name: "Шинэ", criteria: bad }, contextFor(models, ALICE)),
    ).rejects.toThrow(message);
    expect(writes).toHaveLength(0);
  });
});

describe("edureportAssignmentAdd", () => {
  const essay = { classId: "alice-class", title: "Намар", kind: "essay" as const, maxScore: 10 };

  it("adds an essay with the user's own rubric", async () => {
    const { models } = school();

    await expect(
      Mutation.edureportAssignmentAdd(
        undefined,
        { ...essay, rubricId: "alice-rubric", dueDate: "2026-10-01" },
        contextFor(models, ALICE),
      ),
    ).resolves.toMatchObject({ classId: "alice-class", kind: "essay", rubricId: "alice-rubric", dueDate: "2026-10-01" });
  });

  it.each([
    ["an essay without a rubric", {}, "Эссэ даалгаварт шалгуур заавал сонгоно"],
    ["another teacher's rubric", { rubricId: "bob-rubric" }, "Шалгуур олдсонгүй"],
    ["maxScore 0", { rubricId: "alice-rubric", maxScore: 0 }, "Дээд оноо 0-ээс их"],
    ["an impossible due date", { rubricId: "alice-rubric", dueDate: "2026-02-30" }, "Огноо буруу байна"],
    ["a blank title", { rubricId: "alice-rubric", title: "  " }, "Гарчиг хоосон"],
  ])("rejects %s", async (_case, change, message) => {
    const { models, writes } = school();

    await expect(
      Mutation.edureportAssignmentAdd(undefined, { ...essay, ...change }, contextFor(models, ALICE)),
    ).rejects.toThrow(message);
    expect(writes).toHaveLength(0);
  });

  it("does not add to another teacher's class", async () => {
    const { models } = school();

    await expect(
      Mutation.edureportAssignmentAdd(
        undefined,
        { ...essay, classId: "bob-class", rubricId: "alice-rubric" },
        contextFor(models, ALICE),
      ),
    ).rejects.toThrow("Анги олдсонгүй");
  });

  it("lists a class's assignments only for someone who may open the class", async () => {
    const { models } = school();

    const list = await Query.edureportAssignmentList(undefined, { classId: "alice-class" }, contextFor(models, ALICE));

    expect(list.map(({ _id }) => _id)).toEqual(["alice-essay", "alice-task"]);
    await expect(
      Query.edureportAssignmentList(undefined, { classId: "alice-class" }, contextFor(models, BOB)),
    ).rejects.toThrow("Анги олдсонгүй");
  });
});

describe("edureportSubmissionsAdd", () => {
  it("adds essay texts for the class's students", async () => {
    const { models, data } = school();

    const added = await Mutation.edureportSubmissionsAdd(
      undefined,
      { assignmentId: "alice-essay", items: [{ studentId: "s2", text: "Намрын навч." }] },
      contextFor(models, ALICE),
    );

    expect(added).toBe(1);
    expect(data.submissions).toContainEqual(
      expect.objectContaining({ assignmentId: "alice-essay", classId: "alice-class", studentId: "s2", status: "submitted" }),
    );
  });

  it.each([
    ["a task assignment", { assignmentId: "alice-task" }, "Эссэг зөвхөн эссэ даалгаварт оруулна"],
    ["another teacher's assignment", { assignmentId: "bob-essay" }, "Даалгавар олдсонгүй"],
    ["a student of another class", { items: [{ studentId: "bob-s1", text: "Текст" }] }, "Сурагч тухайн ангид"],
    ["an essay over 20 000 characters", { items: [{ studentId: "s1", text: "а".repeat(20_001) }] }, "20000"],
    [
      "more than 100 items",
      { items: Array.from({ length: 101 }, () => ({ studentId: "s1", text: "Текст" })) },
      "100",
    ],
  ])("rejects %s", async (_case, change, message) => {
    const { models, writes } = school();

    await expect(
      Mutation.edureportSubmissionsAdd(
        undefined,
        { assignmentId: "alice-essay", items: [{ studentId: "s1", text: "Текст" }], ...change },
        contextFor(models, ALICE),
      ),
    ).rejects.toThrow(message);
    expect(writes).toHaveLength(0);
  });
});

describe("edureportScoresSet", () => {
  it("sets task scores for the assignment's class, approved by the user", async () => {
    const { models, writes } = school();

    await Mutation.edureportScoresSet(
      undefined,
      { assignmentId: "alice-task", entries: [{ studentId: "s1", score: 8 }] },
      contextFor(models, ALICE),
    );

    expect(writes).toEqual([
      {
        method: "Submissions.setScores",
        args: ["alice-task", "alice-class", [{ studentId: "s1", score: 8 }], ALICE._id],
      },
    ]);
  });

  it.each([
    ["another teacher's assignment", { assignmentId: "bob-essay" }, "Даалгавар олдсонгүй"],
    ["a student of another class", { entries: [{ studentId: "bob-s1", score: 5 }] }, "Сурагч тухайн ангид"],
    ["more than 200 entries", { entries: Array.from({ length: 201 }, () => ({ studentId: "s1", score: 5 })) }, "200"],
  ])("rejects %s", async (_case, change, message) => {
    const { models, writes } = school();

    await expect(
      Mutation.edureportScoresSet(
        undefined,
        { assignmentId: "alice-task", entries: [{ studentId: "s1", score: 5 }], ...change },
        contextFor(models, ALICE),
      ),
    ).rejects.toThrow(message);
    expect(writes).toHaveLength(0);
  });
});

describe("submissions", () => {
  it("lists an assignment's submissions, optionally by status", async () => {
    const { models } = school();
    const alice = contextFor(models, ALICE);

    const all = await Query.edureportSubmissionList(undefined, { assignmentId: "alice-essay" }, alice);
    const approved = await Query.edureportSubmissionList(
      undefined,
      { assignmentId: "alice-essay", status: "approved" },
      alice,
    );

    expect(all.map(({ _id }) => _id)).toEqual(["alice-sub"]);
    expect(approved).toEqual([]);
  });

  it("hides another teacher's submissions like missing ones", async () => {
    const { models } = school();
    const bob = contextFor(models, BOB);

    await expect(Query.edureportSubmissionList(undefined, { assignmentId: "alice-essay" }, bob)).rejects.toThrow(
      "Даалгавар олдсонгүй",
    );
    await expect(Query.edureportSubmissionDetail(undefined, { _id: "alice-sub" }, bob)).rejects.toThrow(
      "Илгээсэн ажил олдсонгүй",
    );
    await expect(
      Mutation.edureportSubmissionApprove(undefined, { _id: "alice-sub", teacherFeedback: "Сайн", score: 9 }, bob),
    ).rejects.toThrow("Илгээсэн ажил олдсонгүй");
  });

  it("approves an essay with the teacher's feedback and score, approved by the user", async () => {
    const { models, data } = school();

    await Mutation.edureportSubmissionApprove(
      undefined,
      { _id: "alice-sub", teacherFeedback: "Бүтэц сайн.", score: 9 },
      contextFor(models, ALICE),
    );

    expect(data.submissions.find(({ _id }) => _id === "alice-sub")).toMatchObject({
      status: "approved",
      score: 9,
      teacherFeedback: "Бүтэц сайн.",
      approvedBy: ALICE._id,
    });
  });

  it("needs feedback to approve", async () => {
    const { models, writes } = school();

    await expect(
      Mutation.edureportSubmissionApprove(
        undefined,
        { _id: "alice-sub", teacherFeedback: "   ", score: 9 },
        contextFor(models, ALICE),
      ),
    ).rejects.toThrow("Багшийн санал хүсэлт хоосон");
    expect(writes).toHaveLength(0);
  });
});

// AI never scores: only the teacher's two scoring mutations write `score`.
describe("score writes (SPEC §1)", () => {
  const SCORING = ["edureportScoresSet", "edureportSubmissionApprove"];

  const mentionsScore = (value: unknown): boolean =>
    Array.isArray(value)
      ? value.some(mentionsScore)
      : typeof value === "object" && value !== null
        ? Object.entries(value).some(([key, inner]) => key === "score" || mentionsScore(inner))
        : false;

  const takesScore = (type: GraphQLInputType, seen = new Set<string>()): boolean => {
    const named = getNamedType(type);

    if (!isInputObjectType(named) || seen.has(named.name)) {
      return false;
    }

    seen.add(named.name);

    return Object.values(named.getFields()).some(
      (field) => field.name === "score" || takesScore(field.type, seen),
    );
  };

  it("only the scoring mutations accept a score in the schema", () => {
    const mutationType = buildSubgraphSchema([{ typeDefs }]).getMutationType();
    const fields = Object.values(mutationType?.getFields() ?? {});

    const withScore = fields
      .filter(({ args }) => args.some((arg) => arg.name === "score" || takesScore(arg.type)))
      .map(({ name }) => name);

    expect(withScore.sort()).toEqual(SCORING);
  });

  it("no other implemented mutation writes a score", async () => {
    const { models, writes } = school();
    const alice = contextFor(models, ALICE);
    const scoringWrites: string[] = [];

    const runs: [string, () => Promise<unknown>][] = [
      ["edureportClassAdd", () => Mutation.edureportClassAdd(undefined, { name: "8А", subject: "Түүх", term: "I" }, alice)],
      ["edureportClassEdit", () => Mutation.edureportClassEdit(undefined, { _id: "alice-class", name: "7В" }, alice)],
      [
        "edureportStudentsImport",
        () =>
          Mutation.edureportStudentsImport(
            undefined,
            { classId: "alice-class", rows: [{ name: "Шинэ", code: "S-050" }] },
            alice,
          ),
      ],
      [
        "edureportAttendanceMark",
        () =>
          Mutation.edureportAttendanceMark(
            undefined,
            { classId: "alice-class", date: "2026-09-07", entries: [{ studentId: "s1", status: "present" }] },
            alice,
          ),
      ],
      ["edureportRubricSave", () => Mutation.edureportRubricSave(undefined, { name: "Шинэ", criteria }, alice)],
      [
        "edureportAssignmentAdd",
        () =>
          Mutation.edureportAssignmentAdd(
            undefined,
            { classId: "alice-class", title: "Даалгавар", kind: "task", maxScore: 10 },
            alice,
          ),
      ],
      [
        "edureportSubmissionsAdd",
        () =>
          Mutation.edureportSubmissionsAdd(
            undefined,
            { assignmentId: "alice-essay", items: [{ studentId: "s2", text: "Эссэ." }] },
            alice,
          ),
      ],
      [
        "edureportScoresSet",
        () =>
          Mutation.edureportScoresSet(
            undefined,
            { assignmentId: "alice-task", entries: [{ studentId: "s1", score: 7 }] },
            alice,
          ),
      ],
      [
        "edureportSubmissionApprove",
        () =>
          Mutation.edureportSubmissionApprove(
            undefined,
            { _id: "alice-sub", teacherFeedback: "Сайн.", score: 9 },
            alice,
          ),
      ],
      ["edureportClassRemove", () => Mutation.edureportClassRemove(undefined, { _id: "alice-class" }, alice)],
    ];

    for (const [name, runMutation] of runs) {
      const before = writes.length;

      await runMutation();

      if (writes.slice(before).some(({ args }) => mentionsScore(args))) {
        scoringWrites.push(name);
      }
    }

    expect(scoringWrites).toEqual(SCORING);
  });
});
