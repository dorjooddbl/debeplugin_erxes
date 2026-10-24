import { ExpectedError } from "erxes-api-shared/utils";
import type { IModels } from "../../../../connectionResolvers.ts";
import type { IClass } from "../../@types/index.ts";
import { classSchema } from "../definitions/classes.ts";

export const loadClassClass = (models: IModels) => {
  class Class {
    public static async getClass(_id: string) {
      const cls = await models.Classes.findOne({ _id });

      if (!cls) {
        throw new ExpectedError("Анги олдсонгүй");
      }

      return cls;
    }

    public static async createClass(doc: IClass) {
      return models.Classes.create(doc);
    }

    // teacherId is not editable: the class stays with the teacher who made it.
    public static async updateClass(_id: string, doc: Partial<Omit<IClass, "teacherId">>) {
      const cls = await models.Classes.findOneAndUpdate(
        { _id },
        { $set: doc },
        { new: true, runValidators: true },
      );

      if (!cls) {
        throw new ExpectedError("Анги олдсонгүй");
      }

      return cls;
    }

    // Everything recorded for the class goes with it. Rubrics belong to the
    // teacher, not the class, and stay.
    public static async removeClass(_id: string) {
      await models.Classes.getClass(_id);

      const filter = { classId: _id };

      await Promise.all([
        models.Students.deleteMany(filter),
        models.Attendances.deleteMany(filter),
        models.Assignments.deleteMany(filter),
        models.Submissions.deleteMany(filter),
        models.Reports.deleteMany(filter),
      ]);

      await models.Classes.deleteOne({ _id });
    }
  }

  classSchema.loadClass(Class);

  return classSchema;
};
