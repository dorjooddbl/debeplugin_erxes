import { gql } from "graphql-tag";
import { queries } from "./schema/schema.ts";

// Every type and operation is prefixed with the plugin name: the gateway
// composes all plugins into one supergraph, so names must be unique across it.
export const typeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.9", import: ["@key"])

  type Query {
    ${queries}
  }
`;
