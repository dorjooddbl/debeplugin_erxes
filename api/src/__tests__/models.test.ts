import { randomUUID } from "node:crypto";
import type { IModels } from "../connectionResolvers.ts";
import type { IAiDraft, SubmissionStatus } from "../modules/edureport/@types/index.ts";
import { connectTestModels, describeWithMongo } from "./helpers/mongo.ts";

// Business rules of the models (docs/SPEC.md §3) against a real MongoDB.
// Skipped unless EDUREPORT_TEST_MONGO_URL is set; see helpers/mongo.ts.
jest.setTimeout(120_000);

const TEACHER = "teacher-1";
const DRAFT: IAiDraft = {
  criteria: [{ criterionKey: "clarity", strengths: ["Тодорхой"], improvements: ["Жишээ нэм"] }],
  model: "gpt-4o-mini",
  generatedAt: new Date(),
};

describeWithMongo("models", () => {
  let models: IModels;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ models, close } = await connectTestModels());
  });

  afterAll(async () => {
    await close?.();
  });

  const newClass = () =>
    models.Classes.createClass({
      name: "7Б",
      subject: "Монгол хэл",
      term: "2026-2027 I улирал",
      teacherId: TEACHER,
    });

  const newClassWithStudents = async (count: number) => {
    const cls = await newClass();
    const rows = Array.from({ length: count }, (_value, i) => ({
      name: `Сурагч ${i + 1}`,
      code: `S-${String(i + 1).padStart(3, "0")}`,
    }));

    await models.Students.bulkInsertStudents(cls._id, rows);

    return { cls, students: await models.Students.listByClass(cls._id) };
  };

  const newEssay = async (classId: string, maxScore = 10) => {
    const rubric = await models.Rubrics.saveRubric(undefined, {
      name: "Эссэ",
      teacherId: TEACHER,
      criteria: [{ key: "clarity", title: "Тодорхой байдал", description: "", levels: [] }],
    });

    return models.Assignments.createAssignment({
      classId,
      title: "Эссэ",
      kind: "essay",
      maxScore,
      rubricId: rubric._id,
    });
  };

  const setStatus = (_id: string, status: SubmissionStatus, extra: Record<string, unknown> = {}) =>
    models.Submissions.updateOne({ _id }, { $set: { status, ...extra } });

  describe("Classes", () => {
    it("reports an unknown class as missing", async () => {
      await expect(models.Classes.getClass(randomUUID())).rejects.toThrow("Анги олдсонгүй");
    });

    it("edits fields and validates the at-risk thresholds", async () => {
      const cls = await newClass();

      const edited = await models.Classes.updateClass(cls._id, { name: "7В", atRiskScorePct: 55 });

      expect(edited).toMatchObject({ name: "7В", atRiskScorePct: 55, teacherId: TEACHER });
      await expect(models.Classes.updateClass(cls._id, { atRiskAttendancePct: 120 })).rejects.toThrow();
    });

    it("removes the class with everything recorded for it, and nothing else", async () => {
      const { cls, students } = await newClassWithStudents(2);
      const other = await newClassWithStudents(1);
      const [first] = students;

      if (!first) throw new Error("no students");

      const essay = await newEssay(cls._id);
      await models.Attendances.bulkMark(cls._id, "2026-09-07", [{ studentId: first._id, status: "present" }], TEACHER);
      await models.Submissions.bulkAdd(essay._id, cls._id, [{ studentId: first._id, text: "Эссэ" }]);
      await models.Reports.createDraft(cls._id, "2026-09-01", "2026-10-31", TEACHER);

      await models.Classes.removeClass(cls._id);

      const left = await Promise.all([
        models.Classes.countDocuments({ _id: cls._id }),
        models.Students.countDocuments({ classId: cls._id }),
        models.Attendances.countDocuments({ classId: cls._id }),
        models.Assignments.countDocuments({ classId: cls._id }),
        models.Submissions.countDocuments({ classId: cls._id }),
        models.Reports.countDocuments({ classId: cls._id }),
      ]);

      expect(left).toEqual([0, 0, 0, 0, 0, 0]);
      expect(await models.Rubrics.countDocuments({ _id: essay.rubricId })).toBe(1);
      expect(await models.Students.countDocuments({ classId: other.cls._id })).toBe(1);
    });
  });

  describe("Students", () => {
    it("inserts new codes and skips ones the class already has or that repeat", async () => {
      const cls = await newClass();

      await models.Students.bulkInsertStudents(cls._id, [{ name: "Номин", code: "S-002" }]);

      const result = await models.Students.bulkInsertStudents(cls._id, [
        { name: "Тэмүүжин", code: "S-001" },
        { name: "Номин 2", code: "S-002" },
        { name: "Анужин", code: "S-003" },
        { name: "Анужин 2", code: "S-003" },
      ]);

      expect(result).toEqual({ inserted: 2, skippedCodes: ["S-002", "S-003"] });

      const students = await models.Students.listByClass(cls._id);

      expect(students.map(({ code, name }) => [code, name])).toEqual([
        ["S-001", "Тэмүүжин"],
        ["S-002", "Номин"],
        ["S-003", "Анужин"],
      ]);
      expect(typeof students[0]?._id).toBe("string");
    });

    it("lets another class use the same code", async () => {
      const a = await newClass();
      const b = await newClass();

      await models.Students.bulkInsertStudents(a._id, [{ name: "Номин", code: "S-001" }]);

      expect(await models.Students.bulkInsertStudents(b._id, [{ name: "Номин", code: "S-001" }])).toEqual({
        inserted: 1,
        skippedCodes: [],
      });
    });
  });

  describe("Attendances", () => {
    it("replaces a day's mark instead of adding a second one", async () => {
      const { cls, students } = await newClassWithStudents(2);
      const entries = students.map(({ _id }) => ({ studentId: _id, status: "present" as const }));

      expect(await models.Attendances.bulkMark(cls._id, "2026-09-07", entries, TEACHER)).toBe(2);

      const [first] = students;
      if (!first) throw new Error("no students");

      expect(
        await models.Attendances.bulkMark(cls._id, "2026-09-07", [{ studentId: first._id, status: "late" }], "teacher-2"),
      ).toBe(1);

      const marks = await models.Attendances.find({ classId: cls._id, studentId: first._id });

      expect(marks.map(({ date, status, markedBy }) => [date, status, markedBy])).toEqual([
        ["2026-09-07", "late", "teacher-2"],
      ]);
    });

    it("lists a date range including both ends", async () => {
      const { cls, students } = await newClassWithStudents(1);
      const [student] = students;
      if (!student) throw new Error("no students");

      for (const date of ["2026-09-06", "2026-09-07", "2026-09-10", "2026-09-11"]) {
        await models.Attendances.bulkMark(cls._id, date, [{ studentId: student._id, status: "present" }], TEACHER);
      }

      const marks = await models.Attendances.listByRange(cls._id, "2026-09-07", "2026-09-10");

      expect(marks.map(({ date }) => date)).toEqual(["2026-09-07", "2026-09-10"]);
    });
  });

  describe("Rubrics", () => {
    it("creates, then edits name and criteria but keeps the owner", async () => {
      const created = await models.Rubrics.saveRubric(undefined, {
        name: "Эссэ",
        teacherId: TEACHER,
        criteria: [{ key: "a", title: "A", description: "", levels: [] }],
      });

      const saved = await models.Rubrics.saveRubric(created._id, {
        name: "Эссэ бичлэг",
        teacherId: "someone-else",
        criteria: [{ key: "b", title: "B", description: "Бүтэц", levels: ["Сул", "Сайн"] }],
      });

      expect(saved.name).toBe("Эссэ бичлэг");
      expect(saved.teacherId).toBe(TEACHER);
      expect(saved.criteria.map(({ key, levels }) => [key, [...levels]])).toEqual([["b", ["Сул", "Сайн"]]]);
      await expect(models.Rubrics.getRubric(randomUUID())).rejects.toThrow("Шалгуур олдсонгүй");
    });
  });

  describe("Assignments", () => {
    it("requires a rubric for essays", async () => {
      const cls = await newClass();

      await expect(
        models.Assignments.createAssignment({ classId: cls._id, title: "Эссэ", kind: "essay", maxScore: 10 }),
      ).rejects.toThrow("Эссэ даалгаварт шалгуур заавал сонгоно");

      await models.Assignments.createAssignment({ classId: cls._id, title: "Тест", kind: "task", maxScore: 20 });
      await newEssay(cls._id);

      const list = await models.Assignments.listByClass(cls._id);

      expect(list.map(({ kind }) => kind)).toEqual(["task", "essay"]);
    });
  });

  describe("Submissions", () => {
    const essayWithSubmissions = async (count: number) => {
      const { cls, students } = await newClassWithStudents(count);
      const essay = await newEssay(cls._id);

      await models.Submissions.bulkAdd(
        essay._id,
        cls._id,
        students.map(({ _id }) => ({ studentId: _id, text: "Анхны эссэ" })),
      );

      const submissions = await models.Submissions.find({ assignmentId: essay._id }).sort({ studentId: 1 });

      return { cls, students, essay, submissions };
    };

    it("bulkAdd: new → submitted; resubmits submitted, failed and aiDrafted; leaves queued and approved", async () => {
      const { cls, essay, submissions } = await essayWithSubmissions(5);
      const [submitted, failed, drafted, queued, approved] = submissions;

      if (!submitted || !failed || !drafted || !queued || !approved) throw new Error("setup");

      expect(submissions.every(({ status, score }) => status === "submitted" && score === undefined)).toBe(true);

      await setStatus(failed._id, "failed", { error: "timeout" });
      await setStatus(drafted._id, "aiDrafted", { aiDraft: DRAFT });
      await setStatus(queued._id, "queued", { queuedAt: new Date() });
      await models.Submissions.approve(approved._id, { teacherFeedback: "Сайн", score: 8, approvedBy: TEACHER });

      const count = await models.Submissions.bulkAdd(
        essay._id,
        cls._id,
        submissions.map(({ studentId }) => ({ studentId, text: "Шинэ эссэ" })),
      );

      expect(count).toBe(3);

      const after = new Map(
        (await models.Submissions.find({ assignmentId: essay._id })).map((s) => [s._id, s]),
      );

      for (const { _id } of [submitted, failed, drafted]) {
        expect(after.get(_id)).toMatchObject({ status: "submitted", text: "Шинэ эссэ" });
        expect(after.get(_id)?.aiDraft).toBeUndefined();
        expect(after.get(_id)?.error).toBeUndefined();
      }

      expect(after.get(queued._id)).toMatchObject({ status: "queued", text: "Анхны эссэ" });
      expect(after.get(approved._id)).toMatchObject({ status: "approved", text: "Анхны эссэ", score: 8 });
    });

    it("markQueued moves only queueable submissions, retakes stuck ones and returns what it moved", async () => {
      const { submissions } = await essayWithSubmissions(5);
      const [submitted, failed, freshQueued, stuckQueued, approved] = submissions;

      if (!submitted || !failed || !freshQueued || !stuckQueued || !approved) throw new Error("setup");

      await setStatus(failed._id, "failed", { error: "timeout" });
      await setStatus(freshQueued._id, "queued", { queuedAt: new Date() });
      await setStatus(stuckQueued._id, "queued", { queuedAt: new Date(Date.now() - 31 * 60 * 1000) });
      await models.Submissions.approve(approved._id, { teacherFeedback: "Сайн", score: 8, approvedBy: TEACHER });

      const moved = await models.Submissions.markQueued([
        ...submissions.map(({ _id }) => _id),
        submitted._id,
        randomUUID(),
      ]);

      expect(moved.sort()).toEqual([submitted._id, failed._id, stuckQueued._id].sort());

      const queuedNow = await models.Submissions.getSubmission(stuckQueued._id);

      expect(queuedNow.status).toBe("queued");
      expect(Date.now() - (queuedNow.queuedAt?.getTime() ?? 0)).toBeLessThan(60_000);
      expect((await models.Submissions.getSubmission(approved._id)).status).toBe("approved");
      expect(await models.Submissions.markQueued([submitted._id])).toEqual([]);
    });

    it("saveAiDraft and markFailed change only queued submissions", async () => {
      const { submissions } = await essayWithSubmissions(3);
      const [a, b, notQueued] = submissions;

      if (!a || !b || !notQueued) throw new Error("setup");

      await models.Submissions.markQueued([a._id, b._id]);
      await models.Submissions.saveAiDraft(a._id, DRAFT);
      await models.Submissions.markFailed(b._id, "LLM timeout");
      await models.Submissions.saveAiDraft(notQueued._id, DRAFT);
      await models.Submissions.markFailed(notQueued._id, "LLM timeout");

      const drafted = await models.Submissions.getSubmission(a._id);

      expect(drafted.status).toBe("aiDrafted");
      expect(drafted.aiDraft?.criteria[0]?.criterionKey).toBe("clarity");
      expect(await models.Submissions.getSubmission(b._id)).toMatchObject({ status: "failed", error: "LLM timeout" });
      expect(await models.Submissions.getSubmission(notQueued._id)).toMatchObject({ status: "submitted" });
      expect((await models.Submissions.getSubmission(notQueued._id)).aiDraft).toBeUndefined();

      // A second draft for the same job is dropped once the first landed.
      await models.Submissions.saveAiDraft(a._id, { ...DRAFT, model: "other" });
      expect((await models.Submissions.getSubmission(a._id)).aiDraft?.model).toBe("gpt-4o-mini");
    });

    it("approve: essays only, not while queued, score within 0..maxScore", async () => {
      const { cls, students, submissions } = await essayWithSubmissions(2);
      const [ready, queued] = submissions;
      const [student] = students;

      if (!ready || !queued || !student) throw new Error("setup");

      await models.Submissions.markQueued([queued._id]);

      await expect(
        models.Submissions.approve(queued._id, { teacherFeedback: "Сайн", score: 5, approvedBy: TEACHER }),
      ).rejects.toThrow("AI ноорог боловсруулагдаж байна");
      await expect(
        models.Submissions.approve(ready._id, { teacherFeedback: "Сайн", score: 11, approvedBy: TEACHER }),
      ).rejects.toThrow("Оноо 0-ээс 10 хооронд байна");
      await expect(
        models.Submissions.approve(ready._id, { teacherFeedback: "Сайн", score: -1, approvedBy: TEACHER }),
      ).rejects.toThrow("Оноо 0-ээс 10 хооронд байна");

      const approved = await models.Submissions.approve(ready._id, {
        teacherFeedback: "Санаа тодорхой",
        score: 7.5,
        approvedBy: TEACHER,
      });

      expect(approved).toMatchObject({ status: "approved", score: 7.5, approvedBy: TEACHER, teacherFeedback: "Санаа тодорхой" });
      expect(approved.approvedAt).toBeInstanceOf(Date);

      // An approved essay can be approved again with a corrected score.
      expect(
        (await models.Submissions.approve(ready._id, { teacherFeedback: "Засав", score: 9, approvedBy: TEACHER })).score,
      ).toBe(9);

      const task = await models.Assignments.createAssignment({ classId: cls._id, title: "Тест", kind: "task", maxScore: 10 });
      await models.Submissions.setScores(task._id, cls._id, [{ studentId: student._id, score: 5 }], TEACHER);
      const taskSubmission = await models.Submissions.findOne({ assignmentId: task._id });

      if (!taskSubmission) throw new Error("setup");

      await expect(
        models.Submissions.approve(taskSubmission._id, { teacherFeedback: "Сайн", score: 5, approvedBy: TEACHER }),
      ).rejects.toThrow("Зөвхөн эссэ даалгаврыг батална");
    });

    it("setScores: tasks only, upserts approved scores, skips unapproved submissions", async () => {
      const { cls, students } = await newClassWithStudents(3);
      const [a, b, c] = students;

      if (!a || !b || !c) throw new Error("setup");

      const task = await models.Assignments.createAssignment({ classId: cls._id, title: "Тест", kind: "task", maxScore: 20 });
      const essay = await newEssay(cls._id);

      await expect(
        models.Submissions.setScores(essay._id, cls._id, [{ studentId: a._id, score: 5 }], TEACHER),
      ).rejects.toThrow("Оноог зөвхөн энгийн даалгаварт шивнэ");
      await expect(
        models.Submissions.setScores(task._id, cls._id, [{ studentId: a._id, score: 21 }], TEACHER),
      ).rejects.toThrow("Оноо 0-ээс 20 хооронд байна");
      await expect(
        models.Submissions.setScores(task._id, randomUUID(), [{ studentId: a._id, score: 5 }], TEACHER),
      ).rejects.toThrow("Даалгавар олдсонгүй");

      // c has a non-approved submission on the task (not a state setScores starts from).
      await models.Submissions.bulkAdd(task._id, cls._id, [{ studentId: c._id, text: "?" }]);

      expect(
        await models.Submissions.setScores(
          task._id,
          cls._id,
          [
            { studentId: a._id, score: 15 },
            { studentId: b._id, score: 0 },
            { studentId: c._id, score: 10 },
          ],
          TEACHER,
        ),
      ).toBe(2);
      expect(await models.Submissions.setScores(task._id, cls._id, [{ studentId: a._id, score: 18 }], "teacher-2")).toBe(1);

      const byStudent = new Map(
        (await models.Submissions.find({ assignmentId: task._id })).map((s) => [s.studentId, s]),
      );

      expect(byStudent.get(a._id)).toMatchObject({ score: 18, status: "approved", approvedBy: "teacher-2", classId: cls._id });
      expect(byStudent.get(b._id)).toMatchObject({ score: 0, status: "approved" });
      expect(byStudent.get(c._id)?.status).toBe("submitted");
      expect(byStudent.get(c._id)?.score).toBeUndefined();
    });

    it("never writes a score outside approve and setScores", async () => {
      const { cls, essay, submissions } = await essayWithSubmissions(2);
      const [approved, other] = submissions;

      if (!approved || !other) throw new Error("setup");

      await models.Submissions.approve(approved._id, { teacherFeedback: "Сайн", score: 6, approvedBy: TEACHER });

      const ids = submissions.map(({ _id }) => _id);
      await models.Submissions.bulkAdd(essay._id, cls._id, submissions.map(({ studentId }) => ({ studentId, text: "Дахин" })));
      await models.Submissions.markQueued(ids);
      await models.Submissions.saveAiDraft(other._id, DRAFT);
      await models.Submissions.markQueued([other._id]);
      await models.Submissions.markFailed(other._id, "x");

      expect((await models.Submissions.getSubmission(approved._id)).score).toBe(6);
      expect((await models.Submissions.getSubmission(other._id)).score).toBeUndefined();
    });
  });

  describe("Reports", () => {
    const metrics = {
      studentCount: 2,
      sessions: 3,
      attendanceRate: 83.3,
      avgScorePct: null,
      perStudent: [
        { studentId: "s1", attendanceRate: 66.7, avgScorePct: null, atRisk: true, reasons: ["attendance" as const] },
        { studentId: "s2", attendanceRate: 100, avgScorePct: null, atRisk: false, reasons: [] },
      ],
      atRiskStudentIds: ["s1"],
    };

    it("draft → generating → ready → approved, copying the AI summary when the teacher wrote nothing", async () => {
      const cls = await newClass();
      const report = await models.Reports.createDraft(cls._id, "2026-09-01", "2026-10-31", TEACHER);

      expect(report.status).toBe("draft");

      await models.Reports.markGenerating(report._id, metrics);
      await models.Reports.saveGenerated(report._id, { aiSummary: "Ангийн ирц 83.3%.", warnings: [] });

      const ready = await models.Reports.getReport(report._id);

      expect(ready.status).toBe("ready");
      expect(ready.metrics?.perStudent[0]).toMatchObject({ studentId: "s1", attendanceRate: 66.7, avgScorePct: null, atRisk: true });

      const approved = await models.Reports.approve(report._id, TEACHER);

      expect(approved).toMatchObject({ status: "approved", teacherText: "Ангийн ирц 83.3%.", approvedBy: TEACHER });
      await expect(models.Reports.updateText(report._id, "Засвар")).rejects.toThrow("Батлагдсан тайланг засахгүй");
      await expect(models.Reports.approve(report._id, TEACHER)).rejects.toThrow("Тайлан аль хэдийн батлагдсан");
    });

    it("keeps the teacher's edited text on approve", async () => {
      const cls = await newClass();
      const report = await models.Reports.createDraft(cls._id, "2026-09-01", "2026-10-31", TEACHER);

      await models.Reports.markGenerating(report._id, metrics);
      await models.Reports.saveGenerated(report._id, { aiSummary: "AI", warnings: ["99"] });
      await models.Reports.updateText(report._id, "Багшийн засвар");

      expect((await models.Reports.approve(report._id, TEACHER)).teacherText).toBe("Багшийн засвар");
    });

    it("allows each transition only from its SPEC start state", async () => {
      const cls = await newClass();
      const report = await models.Reports.createDraft(cls._id, "2026-09-01", "2026-10-31", TEACHER);

      await expect(models.Reports.updateText(report._id, "x")).rejects.toThrow("Тайлан бэлэн болоогүй байна");
      await expect(models.Reports.approve(report._id, TEACHER)).rejects.toThrow("Зөвхөн бэлэн тайланг батална");

      await models.Reports.markGenerating(report._id, metrics);
      await expect(models.Reports.markGenerating(report._id, metrics)).rejects.toThrow("Тайлан ноорог төлөвт биш байна");

      await models.Reports.markFailed(report._id, "LLM timeout");
      await models.Reports.saveGenerated(report._id, { aiSummary: "late", warnings: [] });

      expect(await models.Reports.getReport(report._id)).toMatchObject({ status: "failed", error: "LLM timeout" });
      expect((await models.Reports.getReport(report._id)).aiSummary).toBeUndefined();
      await expect(models.Reports.getReport(randomUUID())).rejects.toThrow("Тайлан олдсонгүй");
    });
  });
});
