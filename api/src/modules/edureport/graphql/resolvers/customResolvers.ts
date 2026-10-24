import type { IContext } from "../../../../connectionResolvers.ts";
import type { IClassDocument } from "../../@types/index.ts";

// Field resolvers for edureport object types. Await queries here: erxes's
// resolver wrapper settles the returned value more than once, and a bare
// mongoose Query refuses to run twice ("Query was already executed").
export const edureportCustomResolvers = {
  EdureportClass: {
    studentCount: async ({ _id }: Pick<IClassDocument, "_id">, _args: unknown, { models }: IContext) =>
      await models.Students.countDocuments({ classId: _id }),
  },
};
