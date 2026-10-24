import { ExpectedError } from "erxes-api-shared/utils";
import type { IContext, IModels } from "../../connectionResolvers.ts";
import type {
  AttendanceStatus,
  IAssignment,
  IAttendance,
  IClass,
  IRubric,
  IStudent,
  ISubmission,
} from "../../modules/edureport/@types/index.ts";

// In-memory stand-ins for the models: just the calls the resolvers make,
// with the results the real models give (models.test.ts covers those against
// Mongo). One instance per subdomain, the way generateModels binds models to
// one tenant. Every write is logged in `writes`, so tests can check which
// operation wrote what.

type Row<T> = T & { _id: string };
type Filter = Record<string, unknown>;

const hasIn = (condition: unknown): condition is { $in: unknown[] } =>
  typeof condition === "object" && condition !== null && "$in" in condition;

const matches = (doc: object, filter: Filter) => {
  const fields = new Map(Object.entries(doc));

  return Object.entries(filter).every(([key, condition]) =>
    hasIn(condition) ? condition.$in.includes(fields.get(key)) : fields.get(key) === condition,
  );
};

// find(filter), awaitable directly or after sort/skip/limit, already in the
// order rows were added.
interface FakeQuery<T> extends Promise<T[]> {
  sort(): FakeQuery<T>;
  skip(count: number): FakeQuery<T>;
  limit(count: number): FakeQuery<T>;
}

const query = <T>(rows: T[]): FakeQuery<T> =>
  Object.assign(Promise.resolve(rows), {
    sort: () => query(rows),
    skip: (count: number) => query(rows.slice(count)),
    limit: (count: number) => query(rows.slice(0, count)),
  });

const finder = <T extends object>(rows: () => T[]) => ({
  findOne: async (filter: Filter) => rows().find((row) => matches(row, filter)) ?? null,
  find: (filter: Filter) => query(rows().filter((row) => matches(row, filter))),
  countDocuments: async (filter: Filter) => rows().filter((row) => matches(row, filter)).length,
});

export interface FakeWrite {
  method: string;
  args: unknown[];
}

export const fakeModels = ({
  classes = [],
  students = [],
  rubrics = [],
  assignments = [],
  submissions = [],
}: {
  classes?: Row<IClass>[];
  students?: Row<IStudent>[];
  rubrics?: Row<IRubric>[];
  assignments?: Row<IAssignment>[];
  submissions?: Row<ISubmission>[];
} = {}) => {
  const data = {
    classes: [...classes],
    students: [...students],
    attendances: [] as Row<IAttendance>[],
    rubrics: [...rubrics],
    assignments: [...assignments],
    submissions: [...submissions],
  };
  const writes: FakeWrite[] = [];
  const record = (method: string, ...args: unknown[]) => writes.push({ method, args });
  let nextId = 0;
  const id = (prefix: string) => `${prefix}-${++nextId}`;

  const Classes = {
    ...finder(() => data.classes),
    createClass: async (doc: IClass) => {
      record("Classes.createClass", doc);

      const cls = { _id: id("class"), ...doc };

      data.classes.push(cls);

      return cls;
    },
    updateClass: async (_id: string, doc: Partial<IClass>) => {
      record("Classes.updateClass", _id, doc);

      const cls = data.classes.find((row) => row._id === _id);

      if (!cls) {
        throw new ExpectedError("Анги олдсонгүй");
      }

      return Object.assign(cls, doc);
    },
    removeClass: async (_id: string) => {
      record("Classes.removeClass", _id);
      data.classes = data.classes.filter((row) => row._id !== _id);
      data.students = data.students.filter((row) => row.classId !== _id);
      data.attendances = data.attendances.filter((row) => row.classId !== _id);
    },
  };

  const Students = {
    ...finder(() => data.students),
    listByClass: async (classId: string) => data.students.filter((row) => row.classId === classId),
    bulkInsertStudents: async (classId: string, rows: { name: string; code: string }[]) => {
      record("Students.bulkInsertStudents", classId, rows);

      const skippedCodes: string[] = [];
      let inserted = 0;

      for (const { name, code } of rows) {
        if (data.students.some((row) => row.classId === classId && row.code === code)) {
          skippedCodes.push(code);
        } else {
          data.students.push({ _id: id("student"), classId, name, code });
          inserted++;
        }
      }

      return { inserted, skippedCodes };
    },
  };

  // Upsert on (classId, studentId, date), as the unique index makes it.
  const Attendances = {
    bulkMark: async (
      classId: string,
      date: string,
      entries: { studentId: string; status: AttendanceStatus }[],
      markedBy: string,
    ) => {
      record("Attendances.bulkMark", classId, date, entries, markedBy);

      for (const { studentId, status } of entries) {
        const existing = data.attendances.find(
          (row) => row.classId === classId && row.studentId === studentId && row.date === date,
        );

        if (existing) {
          Object.assign(existing, { status, markedBy });
        } else {
          data.attendances.push({ _id: id("attendance"), classId, studentId, date, status, markedBy });
        }
      }

      return entries.length;
    },
    listByRange: async (classId: string, from: string, to: string) =>
      data.attendances.filter((row) => row.classId === classId && row.date >= from && row.date <= to),
  };

  // Saving an existing rubric keeps its teacherId, like the real model.
  const Rubrics = {
    ...finder(() => data.rubrics),
    saveRubric: async (_id: string | undefined, doc: IRubric) => {
      record("Rubrics.saveRubric", _id, doc);

      if (!_id) {
        const rubric = { _id: id("rubric"), ...doc };

        data.rubrics.push(rubric);

        return rubric;
      }

      const rubric = data.rubrics.find((row) => row._id === _id);

      if (!rubric) {
        throw new ExpectedError("Шалгуур олдсонгүй");
      }

      return Object.assign(rubric, { name: doc.name, criteria: doc.criteria });
    },
  };

  const Assignments = {
    ...finder(() => data.assignments),
    listByClass: async (classId: string) => data.assignments.filter((row) => row.classId === classId),
    createAssignment: async (doc: IAssignment) => {
      record("Assignments.createAssignment", doc);

      const assignment = { _id: id("assignment"), ...doc };

      data.assignments.push(assignment);

      return assignment;
    },
  };

  const Submissions = {
    ...finder(() => data.submissions),
    bulkAdd: async (assignmentId: string, classId: string, items: { studentId: string; text: string }[]) => {
      record("Submissions.bulkAdd", assignmentId, classId, items);

      for (const { studentId, text } of items) {
        const existing = data.submissions.find(
          (row) => row.assignmentId === assignmentId && row.studentId === studentId,
        );

        if (existing) {
          Object.assign(existing, { text, status: "submitted" });
        } else {
          data.submissions.push({ _id: id("submission"), assignmentId, classId, studentId, text, status: "submitted" });
        }
      }

      return items.length;
    },
    setScores: async (
      assignmentId: string,
      classId: string,
      entries: { studentId: string; score: number }[],
      approvedBy: string,
    ) => {
      record("Submissions.setScores", assignmentId, classId, entries, approvedBy);

      for (const { studentId, score } of entries) {
        const scored = { score, status: "approved" as const, approvedBy };
        const existing = data.submissions.find(
          (row) => row.assignmentId === assignmentId && row.studentId === studentId,
        );

        if (existing) {
          Object.assign(existing, scored);
        } else {
          data.submissions.push({ _id: id("submission"), assignmentId, classId, studentId, ...scored });
        }
      }

      return entries.length;
    },
    approve: async (_id: string, approval: { teacherFeedback: string; score: number; approvedBy: string }) => {
      record("Submissions.approve", _id, approval);

      const submission = data.submissions.find((row) => row._id === _id);

      if (!submission) {
        throw new ExpectedError("Илгээсэн ажил олдсонгүй");
      }

      return Object.assign(submission, approval, { status: "approved" as const });
    },
  };

  return {
    models: { Classes, Students, Attendances, Rubrics, Assignments, Submissions } as unknown as IModels,
    data,
    writes,
  };
};

// Every edureport action except classesViewAll: the edureport:teacher group.
export const TEACHER_ACTIONS = [
  "showClasses",
  "classesManage",
  "attendanceMark",
  "assignmentsManage",
  "feedbackGenerate",
  "submissionsApprove",
  "reportsManage",
  "reportsApprove",
];

export const contextFor = (
  models: IModels,
  user: { _id: string; isOwner?: boolean },
  allowed: readonly string[] = TEACHER_ACTIONS,
  subdomain = "school-a",
) =>
  ({
    models,
    subdomain,
    user,
    // Same rejection checkPermissionGroup gives for a missing action.
    checkPermission: jest.fn(async (action: string) => {
      if (!user.isOwner && !allowed.includes(action)) {
        throw new ExpectedError("Permission required", "FORBIDDEN");
      }
    }),
  }) as unknown as IContext;
