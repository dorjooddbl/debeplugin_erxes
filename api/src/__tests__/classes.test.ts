import { resolvers } from "../apollo/resolvers/index.ts";
import type { IClass, IStudent } from "../modules/edureport/@types/index.ts";
import { TEACHER_ACTIONS, contextFor, fakeModels } from "./helpers/fakeModels.ts";

// Step 4 resolvers (classes, students, attendance) against in-memory models:
// docs/SPEC.md §4 access and §5 validation.

const { Query, Mutation } = resolvers;

const ALICE = { _id: "teacher-alice" };
const BOB = { _id: "teacher-bob" };
const OWNER = { _id: "owner", isOwner: true };

const klass = (_id: string, teacherId: string, term = "2026-2027 I улирал"): IClass & { _id: string } => ({
  _id,
  name: "7Б",
  subject: "Монгол хэл",
  term,
  teacherId,
});

const student = (_id: string, classId: string, code: string): IStudent & { _id: string } => ({
  _id,
  classId,
  name: `Сурагч ${code}`,
  code,
});

const school = () =>
  fakeModels({
    classes: [klass("alice-class", ALICE._id), klass("bob-class", BOB._id, "2026-2027 II улирал")],
    students: [
      student("s1", "alice-class", "S-001"),
      student("s2", "alice-class", "S-002"),
      student("bob-s1", "bob-class", "S-001"),
    ],
  });

describe("class access (SPEC §4)", () => {
  it("lists only the teacher's own classes", async () => {
    const { models } = school();

    const result = await Query.edureportClassList(undefined, {}, contextFor(models, ALICE));

    expect(result.list.map(({ _id }) => _id)).toEqual(["alice-class"]);
    expect(result.totalCount).toBe(1);
  });

  it.each([
    ["classesViewAll", contextFor(school().models, BOB, [...TEACHER_ACTIONS, "classesViewAll"])],
    ["an owner", contextFor(school().models, OWNER, [])],
  ])("lists every class for %s", async (_who, context) => {
    const result = await Query.edureportClassList(undefined, {}, context);

    expect(result.list.map(({ _id }) => _id).sort()).toEqual(["alice-class", "bob-class"]);
    expect(result.totalCount).toBe(2);
  });

  it("filters by term and pages within bounds", async () => {
    const { models } = school();
    const context = contextFor(models, OWNER);

    const term = await Query.edureportClassList(undefined, { term: "2026-2027 II улирал" }, context);
    const page = await Query.edureportClassList(undefined, { page: 2, perPage: 1 }, context);

    expect(term.list.map(({ _id }) => _id)).toEqual(["bob-class"]);
    expect(page.list).toHaveLength(1);
    expect(page.totalCount).toBe(2);
    await expect(Query.edureportClassList(undefined, { perPage: 101 }, context)).rejects.toThrow("Нэг хуудсанд");
    await expect(Query.edureportClassList(undefined, { page: 0 }, context)).rejects.toThrow("Хуудасны дугаар");
  });

  it("hides another teacher's class from every class operation, like a missing one", async () => {
    const { models, data } = school();
    const bob = contextFor(models, BOB);
    const range = { from: "2026-09-01", to: "2026-09-30" };

    const attempts = [
      Query.edureportClassDetail(undefined, { _id: "alice-class" }, bob),
      Query.edureportStudentList(undefined, { classId: "alice-class" }, bob),
      Query.edureportAttendanceList(undefined, { classId: "alice-class", ...range }, bob),
      Mutation.edureportClassEdit(undefined, { _id: "alice-class", name: "Хакердсан" }, bob),
      Mutation.edureportClassRemove(undefined, { _id: "alice-class" }, bob),
      Mutation.edureportStudentsImport(
        undefined,
        { classId: "alice-class", rows: [{ name: "Шинэ", code: "S-099" }] },
        bob,
      ),
      Mutation.edureportAttendanceMark(
        undefined,
        { classId: "alice-class", date: "2026-09-07", entries: [{ studentId: "s1", status: "absent" }] },
        bob,
      ),
      Query.edureportClassDetail(undefined, { _id: "no-such-class" }, bob),
    ];

    for (const attempt of attempts) {
      await expect(attempt).rejects.toThrow("Анги олдсонгүй");
    }

    expect(data.classes.find(({ _id }) => _id === "alice-class")?.name).toBe("7Б");
    expect(data.students.filter(({ classId }) => classId === "alice-class")).toHaveLength(2);
    expect(data.attendances).toHaveLength(0);
  });

  it("lets classesViewAll and owners open any class", async () => {
    const viewAll = contextFor(school().models, BOB, [...TEACHER_ACTIONS, "classesViewAll"]);
    const owner = contextFor(school().models, OWNER);

    await expect(Query.edureportClassDetail(undefined, { _id: "alice-class" }, viewAll)).resolves.toMatchObject({
      _id: "alice-class",
    });
    await expect(Query.edureportClassDetail(undefined, { _id: "alice-class" }, owner)).resolves.toMatchObject({
      _id: "alice-class",
    });
  });

  it("does not swallow errors other than a denied classesViewAll", async () => {
    const { models } = school();
    const context = contextFor(models, BOB);
    const outage = new Error("core unreachable");

    jest.mocked(context.checkPermission).mockResolvedValueOnce().mockRejectedValueOnce(outage);

    await expect(Query.edureportClassDetail(undefined, { _id: "alice-class" }, context)).rejects.toBe(outage);
  });
});

describe("subdomains", () => {
  it("never mixes data between tenants", async () => {
    const schoolA = fakeModels({ classes: [klass("a-class", ALICE._id)] });
    const schoolB = fakeModels({ classes: [klass("b-class", ALICE._id)] });
    const inA = contextFor(schoolA.models, ALICE, TEACHER_ACTIONS, "school-a");
    const inB = contextFor(schoolB.models, OWNER, [], "school-b");

    const listA = await Query.edureportClassList(undefined, {}, inA);
    const listB = await Query.edureportClassList(undefined, {}, inB);

    expect(listA.list.map(({ _id }) => _id)).toEqual(["a-class"]);
    expect(listB.list.map(({ _id }) => _id)).toEqual(["b-class"]);
    // Even an owner of school B cannot reach school A's class by id.
    await expect(Query.edureportClassDetail(undefined, { _id: "a-class" }, inB)).rejects.toThrow("Анги олдсонгүй");
  });
});

describe("class mutations", () => {
  it("makes the signed-in user the teacher of a new class", async () => {
    const { models, data } = fakeModels();

    const cls = await Mutation.edureportClassAdd(
      undefined,
      { name: "8А", subject: "Уран зохиол", term: "2026-2027 I улирал", grade: null },
      contextFor(models, ALICE),
    );

    expect(cls).toMatchObject({ name: "8А", teacherId: ALICE._id });
    expect(data.classes).toHaveLength(1);
    expect(data.classes[0]).not.toHaveProperty("grade");
  });

  it("edits only the fields sent and checks the at-risk thresholds", async () => {
    const { models, data } = school();
    const alice = contextFor(models, ALICE);

    await Mutation.edureportClassEdit(
      undefined,
      { _id: "alice-class", name: "7В", subject: null, atRiskAttendancePct: 75 },
      alice,
    );

    expect(data.classes[0]).toMatchObject({ name: "7В", subject: "Монгол хэл", atRiskAttendancePct: 75 });
    await expect(
      Mutation.edureportClassEdit(undefined, { _id: "alice-class", atRiskScorePct: 101 }, alice),
    ).rejects.toThrow("Онооны босго 0-ээс 100");
    await expect(
      Mutation.edureportClassEdit(undefined, { _id: "alice-class", atRiskAttendancePct: -1 }, alice),
    ).rejects.toThrow("Ирцийн босго 0-ээс 100");
  });

  it("removes the teacher's own class", async () => {
    const { models, data } = school();

    await expect(
      Mutation.edureportClassRemove(undefined, { _id: "alice-class" }, contextFor(models, ALICE)),
    ).resolves.toBe(true);
    expect(data.classes.map(({ _id }) => _id)).toEqual(["bob-class"]);
    expect(data.students.map(({ _id }) => _id)).toEqual(["bob-s1"]);
  });
});

describe("edureportStudentsImport", () => {
  it("imports the good rows and reports each bad row by its number", async () => {
    const { models, data } = school();

    const result = await Mutation.edureportStudentsImport(
      undefined,
      {
        classId: "alice-class",
        rows: [
          { name: "  Б. Номин ", code: " S-010 " },
          { name: "", code: "S-011" },
          { name: "Д. Тэмүүжин", code: "   " },
          { name: "Г. Анужин", code: "S-001" },
          { name: "Э. Билгүүн", code: "S-012" },
        ],
      },
      contextFor(models, ALICE),
    );

    expect(result).toEqual({
      inserted: 2,
      skippedCodes: ["S-001"],
      errors: [
        { row: 2, message: "Нэр хоосон байна" },
        { row: 3, message: "Код хоосон байна" },
      ],
    });
    expect(data.students).toContainEqual(expect.objectContaining({ classId: "alice-class", name: "Б. Номин", code: "S-010" }));
  });

  it("rejects more than 200 rows in one call", async () => {
    const { models, data } = school();
    const rows = Array.from({ length: 201 }, (_row, index) => ({ name: "Сурагч", code: `S-${index}` }));

    await expect(
      Mutation.edureportStudentsImport(undefined, { classId: "alice-class", rows }, contextFor(models, ALICE)),
    ).rejects.toThrow("200");
    expect(data.students).toHaveLength(3);
  });
});

describe("edureportAttendanceMark", () => {
  it("replaces a day's mark when it is marked again, recording who marked it", async () => {
    const { models, data } = school();
    const date = "2026-09-07";

    const first = await Mutation.edureportAttendanceMark(
      undefined,
      {
        classId: "alice-class",
        date,
        entries: [
          { studentId: "s1", status: "present" },
          { studentId: "s2", status: "absent" },
        ],
      },
      contextFor(models, ALICE),
    );
    const again = await Mutation.edureportAttendanceMark(
      undefined,
      { classId: "alice-class", date, entries: [{ studentId: "s2", status: "late" }] },
      contextFor(models, OWNER),
    );

    expect([first, again]).toEqual([2, 1]);
    expect(data.attendances).toHaveLength(2);
    expect(data.attendances.find(({ studentId }) => studentId === "s2")).toMatchObject({
      status: "late",
      markedBy: OWNER._id,
    });

    const listed = await Query.edureportAttendanceList(
      undefined,
      { classId: "alice-class", from: date, to: date },
      contextFor(models, ALICE),
    );

    expect(listed).toHaveLength(2);
  });

  it("rejects a student of another class and writes nothing", async () => {
    const { models, data } = school();

    await expect(
      Mutation.edureportAttendanceMark(
        undefined,
        {
          classId: "alice-class",
          date: "2026-09-07",
          entries: [
            { studentId: "s1", status: "present" },
            { studentId: "bob-s1", status: "present" },
          ],
        },
        contextFor(models, ALICE),
      ),
    ).rejects.toThrow("Сурагч тухайн ангид харьяалагдахгүй байна");
    expect(data.attendances).toHaveLength(0);
  });

  it.each(["2026-02-30", "2026-9-7", "07/09/2026"])("rejects the date %s", async (date) => {
    const { models } = school();

    await expect(
      Mutation.edureportAttendanceMark(
        undefined,
        { classId: "alice-class", date, entries: [{ studentId: "s1", status: "present" }] },
        contextFor(models, ALICE),
      ),
    ).rejects.toThrow("Огноо буруу байна");
  });

  it("rejects more than 200 entries in one call", async () => {
    const { models } = school();
    const entries = Array.from({ length: 201 }, () => ({ studentId: "s1", status: "present" as const }));

    await expect(
      Mutation.edureportAttendanceMark(
        undefined,
        { classId: "alice-class", date: "2026-09-07", entries },
        contextFor(models, ALICE),
      ),
    ).rejects.toThrow("200");
  });
});

describe("edureportAttendanceList", () => {
  it("needs a real range with from ≤ to", async () => {
    const { models } = school();
    const alice = contextFor(models, ALICE);

    await expect(
      Query.edureportAttendanceList(undefined, { classId: "alice-class", from: "2026-09-30", to: "2026-09-01" }, alice),
    ).rejects.toThrow("Эхлэх огноо дуусах огнооноос хойш байна");
    await expect(
      Query.edureportAttendanceList(undefined, { classId: "alice-class", from: "2026-13-01", to: "2026-13-02" }, alice),
    ).rejects.toThrow("Огноо буруу байна");
  });
});

describe("EdureportClass.studentCount", () => {
  it("counts the class's students", async () => {
    const { models } = school();

    await expect(
      resolvers.EdureportClass.studentCount({ _id: "alice-class" }, {}, contextFor(models, ALICE)),
    ).resolves.toBe(2);
  });
});
