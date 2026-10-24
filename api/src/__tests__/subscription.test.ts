import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { generateResolvers, typeDefs } from "../apollo/subscription.cjs";

const JOB_ID = "acme:feedback:abc123";

describe("edureportJobProgress subscription", () => {
  const iterator: AsyncIterator<unknown> = { next: async () => ({ done: true, value: undefined }) };
  const asyncIterator = jest.fn<AsyncIterator<unknown>, [string]>().mockReturnValue(iterator);
  const { edureportJobProgress } = generateResolvers({ asyncIterator });
  const user = { _id: "teacher-1" };

  beforeEach(() => asyncIterator.mockClear());

  it("listens on the job's topic for a signed-in user of the job's subdomain", () => {
    const subscription = edureportJobProgress.subscribe(
      undefined,
      { jobId: JOB_ID },
      { subdomain: "acme", user },
    );

    expect(subscription).toBe(iterator);
    expect(asyncIterator).toHaveBeenCalledWith(`edureportJobProgress:${JOB_ID}`);
  });

  it.each([
    ["no signed-in user", { subdomain: "acme", user: null }],
    ["another subdomain's job", { subdomain: "other", user }],
    ["a subdomain that only prefixes the job's", { subdomain: "ac", user }],
    ["no subdomain", { user }],
  ])("reports a missing job for %s", (_case, context) => {
    expect(() => edureportJobProgress.subscribe(undefined, { jobId: JOB_ID }, context)).toThrow(
      "Ажил олдсонгүй",
    );
    expect(asyncIterator).not.toHaveBeenCalled();
  });

  it("resolves the published payload", () => {
    const progress = { total: 30, done: 18, failed: 1, finished: false, lastId: "s-18" };

    expect(edureportJobProgress.resolve({ edureportJobProgress: progress })).toBe(progress);
  });

  it("declares the field the gateway adds to its Subscription type", () => {
    expect(typeDefs).toContain("edureportJobProgress(jobId: String!): EdureportJobProgress");
  });

  // The gateway import()s the downloaded file with plain Node, outside this
  // package: it must load without TypeScript, jest or any dependency.
  it("loads in plain Node the way the gateway imports it", () => {
    const file = join(__dirname, "..", "apollo", "subscription.cjs");
    const script = `import(${JSON.stringify(file)}).then((m) => {
      const plugin = m.default || m;
      const resolvers = plugin.generateResolvers({ asyncIterator: () => ({}) });
      console.log(typeof plugin.typeDefs, Object.keys(resolvers).join(","));
    })`;

    const output = execFileSync(process.execPath, ["-e", script], { encoding: "utf8" });

    expect(output.trim()).toBe("string edureportJobProgress");
  });
});
