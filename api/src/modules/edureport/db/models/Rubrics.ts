import { ExpectedError } from "erxes-api-shared/utils";
import type { IModels } from "../../../../connectionResolvers.ts";
import type { IRubric } from "../../@types/index.ts";
import { rubricSchema } from "../definitions/rubrics.ts";

export const loadRubricClass = (models: IModels) => {
  class Rubric {
    public static async getRubric(_id: string) {
      const rubric = await models.Rubrics.findOne({ _id });

      if (!rubric) {
        throw new ExpectedError("Шалгуур олдсонгүй");
      }

      return rubric;
    }

    // Saving an existing rubric changes its name and criteria; the owner
    // (teacherId) stays.
    public static async saveRubric(_id: string | undefined, doc: IRubric) {
      if (!_id) {
        return models.Rubrics.create(doc);
      }

      const rubric = await models.Rubrics.findOneAndUpdate(
        { _id },
        { $set: { name: doc.name, criteria: doc.criteria } },
        { new: true, runValidators: true },
      );

      if (!rubric) {
        throw new ExpectedError("Шалгуур олдсонгүй");
      }

      return rubric;
    }
  }

  rubricSchema.loadClass(Rubric);

  return rubricSchema;
};
