import { buildSubgraphSchema } from "@apollo/subgraph";
import { concatAST, printSchema } from "graphql";
import { gql } from "graphql-tag";
import { typeDefs as subscriptionTypeDefs } from "./subscription.cjs";
import { typeDefs } from "./typeDefs.ts";

// The SDL clients see: the subgraph plus the Subscription fields the gateway
// serves from subscription.cjs. ui/ codegen validates its documents against it.
export const printClientSdl = (): string =>
  printSchema(
    buildSubgraphSchema([
      {
        typeDefs: concatAST([
          typeDefs,
          gql(`type Subscription {
            ${subscriptionTypeDefs}
          }`),
        ]),
      },
    ]),
  );
