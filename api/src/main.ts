import { join } from "node:path";
import { startPlugin } from "erxes-api-shared/utils";
import { resolvers } from "./apollo/resolvers/index.ts";
import { typeDefs } from "./apollo/typeDefs.ts";
import { manifest } from "./config.ts";
import { generateModels } from "./connectionResolvers.ts";
import { permissions } from "./meta/permissions.ts";
import { startFeedbackWorker } from "./worker/feedbackWorker.ts";
import { startReportWorker } from "./worker/reportWorker.ts";

// startPlugin serves the federated subgraph on /graphql, mounts /health,
// wires tRPC + agent-tools, parses the gateway `user`/`hostname` headers into
// the context, and registers this service with the erxes gateway through
// Redis — including UI_ENTRY_URL so core-ui can find the UI remote.
startPlugin({
  name: manifest.name,
  port: manifest.api.port,
  graphql: async () => ({ typeDefs, resolvers }),
  // Served as /subscriptionPlugin.js for the gateway. The same plain-JS file
  // runs from src/ in dev and dist/ in production (tsc copies it).
  hasSubscriptions: true,
  subscriptionPluginPath: join(__dirname, "apollo", "subscription.cjs"),
  apolloServerContext: async (subdomain, context) => {
    context.models = await generateModels(subdomain, context);

    return context;
  },
  meta: {
    permissions,
  },
});

startFeedbackWorker();
startReportWorker();
