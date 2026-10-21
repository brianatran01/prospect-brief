import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { POST as briefRoute } from "../app/api/brief/route";
import { POST as scanRoute } from "../app/api/scan/route";
import { generateBrief } from "../lib/claude";
import { HttpError } from "../lib/http";
import type { BriefResult, ScanResult } from "../lib/types";
import { SCRIPTS, cleanBrief, html, mockFetch, scanFrom } from "./helpers";

const message = (text: string, stopReason = "end_turn") => ({
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-5-5",
  content: [{ type: "text", text }],
  stop_reason: stopReason,
  stop_sequence: null,
  usage: { input_tokens: 3000, output_tokens: 1000 },
});
const claudeReply = (body: unknown, status = 200) => () =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const store = {
  "https://brand.com/": () =>
    html(`${SCRIPTS.theme}${SCRIPTS.klaviyo}${SCRIPTS.meta}<h1>Basics, made well</h1>`, '<meta property="og:site_name" content="Brand">'),
  "https://brand.com/products.json?limit=250": () =>
    Response.json({
      products: [
        { title: "Classic Tee", product_type: "Tops", variants: [{ price: "28.00" }] },
        { title: "Hoodie", product_type: "Tops", variants: [{ price: "64.00" }, { price: "72.00" }] },
      ],
    }),
};

const post = (route: (req: Request) => Promise<Response>, body: unknown) =>
  route(
    new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const realFetch = globalThis.fetch;
const env = { ...process.env };

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.ANTHROPIC_MODEL;
  delete process.env.ANTHROPIC_EFFORT;
  delete process.env.ANTHROPIC_BASE_URL;
  delete process.env.DEMO_ACCESS_CODE;
  delete process.env.PRICE_INPUT_PER_MTOK;
  delete process.env.PRICE_OUTPUT_PER_MTOK;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...env };
});

test("sends a structured-output request and parses the brief", async () => {
  const calls = mockFetch({}, claudeReply(message(JSON.stringify(cleanBrief))));
  const internals = scanFrom([SCRIPTS.theme, SCRIPTS.klaviyo].join(""), [{ title: "Classic Tee", type: "Tops", prices: [28] }]);
  const { brief, stats } = await generateBrief(internals);

  assert.equal(calls.length, 1);
  const sent = calls[0].body as {
    model: string;
    output_config: { effort: string; format: { type: string; schema: { required: string[] } } };
    tool_choice?: unknown;
    messages: { content: string }[];
  };
  assert.equal(sent.model, "claude-sonnet-5-5");
  assert.equal(sent.output_config.effort, "medium");
  assert.equal(sent.output_config.format.type, "json_schema");
  assert.deepEqual(sent.output_config.format.schema.required, [
    "snapshot",
    "angle",
    "talking_points",
    "persona_guesses",
    "questions",
    "opener",
  ]);
  assert.equal(sent.tool_choice, undefined);
  assert.match(sent.messages[0].content, /- Klaviyo \(Email\), an OuterSignal integration/);
  assert.match(sent.messages[0].content, /- Classic Tee \(Tops\): 28\.00/);

  assert.equal(brief.opener, cleanBrief.opener);
  assert.equal(stats.costUsd, 0.016);
});

test("turns a refusal into a clear error", async () => {
  mockFetch({}, claudeReply(message("", "refusal")));
  await assert.rejects(
    generateBrief(scanFrom(SCRIPTS.klaviyo, [])),
    (err: unknown) => err instanceof HttpError && err.status === 422,
  );
});

test("explains a rejected API key", async () => {
  mockFetch({}, claudeReply({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, 401));
  await assert.rejects(generateBrief(scanFrom(SCRIPTS.klaviyo, [])), /key was rejected/);
});

test("the brief route re-scans the store, writes the brief, then fact-checks it", async () => {
  const calls = mockFetch(store, claudeReply(message(JSON.stringify(cleanBrief))));
  const res = await post(briefRoute, { url: "brand.com" });
  assert.equal(res.status, 200);
  const result = (await res.json()) as BriefResult;
  assert.equal(result.scan.name, "Brand");
  assert.deepEqual(result.check.flags, []);
  assert.ok(result.check.marks.angle.some((m) => m.term === "Klaviyo" && m.ok));
  assert.ok(calls.some((c) => c.url === "https://brand.com/products.json?limit=250"));
});

test("the brief route asks for the key before fetching any store", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const calls = mockFetch(store);
  const res = await post(briefRoute, { url: "brand.com" });
  assert.equal(res.status, 500);
  assert.match(((await res.json()) as { error: string }).error, /ANTHROPIC_API_KEY/);
  assert.deepEqual(calls, []);
});

test("the scan route returns the scan without calling Claude", async () => {
  const calls = mockFetch(store);
  const res = await post(scanRoute, { url: "brand.com" });
  assert.equal(res.status, 200);
  const scan = (await res.json()) as ScanResult & { siteText?: string };
  assert.equal(scan.fit.rating, "good");
  assert.equal(scan.siteText, undefined);
  assert.ok(calls.every((c) => !c.url.includes("anthropic")));
});

test("both routes require the access code when one is set", async () => {
  process.env.DEMO_ACCESS_CODE = "letmein";
  mockFetch(store, claudeReply(message(JSON.stringify(cleanBrief))));
  assert.equal((await post(scanRoute, { url: "brand.com" })).status, 401);
  assert.equal((await post(briefRoute, { url: "brand.com", accessCode: "wrong" })).status, 401);
  assert.equal((await post(scanRoute, { url: "brand.com", accessCode: "letmein" })).status, 200);
  assert.equal((await post(briefRoute, { url: "brand.com", accessCode: "letmein" })).status, 200);
});
