import { apolloCustomScalars } from "erxes-api-shared/utils";
import { edureportCustomResolvers } from "../../modules/edureport/graphql/resolvers/customResolvers.ts";
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
  ...edureportCustomResolvers,
};
