import { buildSubgraphSchema } from "@apollo/subgraph";
import { graphql } from "graphql";
import { resolvers } from "../apollo/resolvers/index.ts";
import { typeDefs } from "../apollo/typeDefs.ts";

describe("edureport subgraph", () => {
  it('answers edureportHealth with "ok"', async () => {
    const schema = buildSubgraphSchema([{ typeDefs, resolvers }]);

    const result = await graphql({ schema, source: "{ edureportHealth }" });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ edureportHealth: "ok" });
  });
});
