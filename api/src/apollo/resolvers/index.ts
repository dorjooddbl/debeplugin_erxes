import { apolloCustomScalars } from "erxes-api-shared/utils";
import { mutations } from "./mutations.ts";
import { queries } from "./queries.ts";

export const resolvers = {
  Date: apolloCustomScalars.Date,
  Query: {
    ...queries,
  },
  Mutation: {
    ...mutations,
  },
};
