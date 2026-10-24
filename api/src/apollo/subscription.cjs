// edureportJobProgress, resolved inside the erxes gateway: docs/SPEC.md §5, §7.
//
// The gateway downloads this file from the plugin's /subscriptionPlugin.js,
// saves it in its own folder and imports it there, so it stays plain
// CommonJS with no imports: no TypeScript syntax, plugin code or models.
// tsc type-checks the JSDoc (checkJs). The payload type EdureportJobProgress
// lives in the subgraph schema, which the gateway subscribes against.
"use strict";

/**
 * @typedef {{ asyncIterator: (topic: string) => AsyncIterator<unknown> }} GatewayPubsub
 * @typedef {{ subdomain?: string; user?: { _id?: string } | null }} GatewayContext
 * @typedef {{ edureportJobProgress: unknown }} JobProgressPayload
 */

const JOB_NOT_FOUND = "Ажил олдсонгүй";

exports.typeDefs = `
  edureportJobProgress(jobId: String!): EdureportJobProgress
`;

/** @param {GatewayPubsub} graphqlPubsub */
exports.generateResolvers = (graphqlPubsub) => ({
  edureportJobProgress: {
    /** @param {JobProgressPayload} payload */
    resolve: (payload) => payload.edureportJobProgress,
    // Signed-in user and a jobId issued for this subdomain
    // (`${subdomain}:${type}:${randomId}`); anything else looks missing.
    /**
     * @param {unknown} _root
     * @param {{ jobId: string }} args
     * @param {GatewayContext} context
     */
    subscribe: (_root, { jobId }, { subdomain, user }) => {
      if (!user?._id || !subdomain || !jobId.startsWith(`${subdomain}:`)) {
        throw new Error(JOB_NOT_FOUND);
      }

      return graphqlPubsub.asyncIterator(`edureportJobProgress:${jobId}`);
    },
  },
});
