import { ExpectedError } from "erxes-api-shared/utils";
import type { IContext, IModels } from "../../connectionResolvers.ts";
import type { AttendanceStatus, IAttendance, IClass, IStudent } from "../../modules/edureport/@types/index.ts";

// In-memory stand-ins for the Classes, Students and Attendances models: just
// the calls the step-4 resolvers make, with the same results the real
// models give (models.test.ts covers those against Mongo). One instance per
// subdomain, the way generateModels binds models to one tenant.

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

// find(filter).sort().skip(n).limit(n), already in the order rows were added.
const query = <T>(rows: T[]) => ({
  sort: () => query(rows),
  skip: (count: number) => query(rows.slice(count)),
  limit: async (count: number) => rows.slice(0, count),
});

const notFound = () => new ExpectedError("Анги олдсонгүй");

export const fakeModels = ({
  classes = [],
  students = [],
}: {
  classes?: Row<IClass>[];
  students?: Row<IStudent>[];
} = {}) => {
  const data = {
    classes: [...classes],
    students: [...students],
    attendances: [] as Row<IAttendance>[],
  };
  let nextId = 0;
  const id = (prefix: string) => `${prefix}-${++nextId}`;

  const Classes = {
    findOne: async (filter: Filter) => data.classes.find((cls) => matches(cls, filter)) ?? null,
    find: (filter: Filter) => query(data.classes.filter((cls) => matches(cls, filter))),
    countDocuments: async (filter: Filter) => data.classes.filter((cls) => matches(cls, filter)).length,
    createClass: async (doc: IClass) => {
      const cls = { _id: id("class"), ...doc };

      data.classes.push(cls);

      return cls;
    },
    updateClass: async (_id: string, doc: Partial<IClass>) => {
      const cls = data.classes.find((row) => row._id === _id);

      if (!cls) {
        throw notFound();
      }

      return Object.assign(cls, doc);
    },
    removeClass: async (_id: string) => {
      data.classes = data.classes.filter((row) => row._id !== _id);
      data.students = data.students.filter((row) => row.classId !== _id);
      data.attendances = data.attendances.filter((row) => row.classId !== _id);
    },
  };

  const Students = {
    countDocuments: async (filter: Filter) => data.students.filter((row) => matches(row, filter)).length,
    listByClass: async (classId: string) => data.students.filter((row) => row.classId === classId),
    bulkInsertStudents: async (classId: string, rows: { name: string; code: string }[]) => {
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

  return { models: { Classes, Students, Attendances } as unknown as IModels, data };
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
