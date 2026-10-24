import type { IModels } from "../../../../connectionResolvers.ts";
import type { AttendanceStatus } from "../../@types/index.ts";
import { attendanceSchema } from "../definitions/attendances.ts";

export const loadAttendanceClass = (models: IModels) => {
  class Attendance {
    // Upsert on (classId, studentId, date): marking a day again replaces the
    // earlier status instead of adding a second record.
    public static async bulkMark(
      classId: string,
      date: string,
      entries: { studentId: string; status: AttendanceStatus }[],
      markedBy: string,
    ) {
      if (!entries.length) {
        return 0;
      }

      const result = await models.Attendances.bulkWrite(
        entries.map(({ studentId, status }) => ({
          updateOne: {
            filter: { classId, studentId, date },
            update: { $set: { status, markedBy } },
            upsert: true,
          },
        })),
      );

      return result.upsertedCount + result.matchedCount;
    }

    // Inclusive; 'YYYY-MM-DD' strings sort as dates.
    public static async listByRange(classId: string, from: string, to: string) {
      return models.Attendances.find({ classId, date: { $gte: from, $lte: to } }).sort({
        date: 1,
        studentId: 1,
      });
    }
  }

  attendanceSchema.loadClass(Attendance);

  return attendanceSchema;
};
