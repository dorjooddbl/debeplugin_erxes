import type { IModels } from "../../../../connectionResolvers.ts";
import { studentSchema } from "../definitions/students.ts";

export const loadStudentClass = (models: IModels) => {
  class Student {
    public static async listByClass(classId: string) {
      return models.Students.find({ classId }).sort({ code: 1 });
    }

    // One upsert per row on the unique (classId, code) index: a code the class
    // already has, or that repeats within `rows`, is left as is and reported.
    public static async bulkInsertStudents(
      classId: string,
      rows: { name: string; code: string }[],
    ) {
      if (!rows.length) {
        return { inserted: 0, skippedCodes: [] };
      }

      const result = await models.Students.bulkWrite(
        rows.map(({ name, code }) => ({
          updateOne: {
            filter: { classId, code },
            update: { $setOnInsert: { name } },
            upsert: true,
          },
        })),
      );

      const insertedRows = new Set(Object.keys(result.upsertedIds).map(Number));

      return {
        inserted: result.upsertedCount,
        skippedCodes: rows.filter((_row, index) => !insertedRows.has(index)).map(({ code }) => code),
      };
    }
  }

  studentSchema.loadClass(Student);

  return studentSchema;
};
