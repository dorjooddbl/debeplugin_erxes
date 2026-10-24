import {
  mutations as edureportMutations,
  queries as edureportQueries,
  types as edureportTypes,
} from "../../modules/edureport/graphql/schemas/edureport.ts";

export const types = `
  ${edureportTypes}
`;

export const queries = `
  ${edureportQueries}
`;

export const mutations = `
  ${edureportMutations}
`;
