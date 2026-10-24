import { ExpectedError } from "erxes-api-shared/utils";
import type { IModels } from "../../../../connectionResolvers.ts";
import type { IAssignment } from "../../@types/index.ts";
import { assignmentSchema } from "../definitions/assignments.ts";

export const loadAssignmentClass = (models: IModels) => {
  class Assignment {
    public static async getAssignment(_id: string) {
      const assignment = await models.Assignments.findOne({ _id });

      if (!assignment) {
        throw new ExpectedError("Даалгавар олдсонгүй");
      }

      return assignment;
    }

    public static async createAssignment(doc: IAssignment) {
      if (doc.kind === "essay" && !doc.rubricId) {
        throw new ExpectedError("Эссэ даалгаварт шалгуур заавал сонгоно");
      }

      return models.Assignments.create(doc);
    }

    public static async listByClass(classId: string) {
      return models.Assignments.find({ classId }).sort({ createdAt: 1 });
    }
  }

  assignmentSchema.loadClass(Assignment);

  return assignmentSchema;
};
