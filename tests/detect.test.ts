import { test } from "node:test";
import assert from "node:assert/strict";
import { detectPlatform, detectTools } from "../lib/detect";
import { SCRIPTS } from "./helpers";

const page = (body: string) => `<!doctype html><html><head><title>Store</title></head><body>${body}</body></html>`;

test("finds each OuterSignal integration from the code it loads", () => {
  const tools = detectTools(
    page(
      [SCRIPTS.klaviyo, SCRIPTS.attentive, SCRIPTS.postscript, SCRIPTS.gorgias, SCRIPTS.yotpo, SCRIPTS.recharge, SCRIPTS.meta].join(
        "\n",
      ),
    ),
  );
  assert.deepEqual(
    tools.map((t) => t.id),
    ["klaviyo", "attentive", "postscript", "gorgias", "yotpo", "recharge", "meta"],
  );
  assert.ok(tools.every((t) => t.listed));
  assert.match(tools[0].evidence, /static\.klaviyo\.com/);
  assert.equal(tools[0].match, "static.klaviyo.com");
});

test("finds email platforms that aren't on OuterSignal's list", () => {
  const tools = detectTools(page(SCRIPTS.omnisend));
  assert.deepEqual(
    tools.map((t) => [t.id, t.listed]),
    [["omnisend", false]],
  );
});

test("finds the Meta Pixel when Shopify loads it as a web pixel", () => {
  const tools = detectTools(page('<script>var webPixelsConfigList = [{"configuration":"{\\"pixel_id\\":\\"123\\",\\"pixel_type\\":\\"facebook_pixel\\"}"}];</script>'));
  assert.deepEqual(
    tools.map((t) => t.id),
    ["meta"],
  );
});

test("ignores ordinary words that happen to be tool names", () => {
  const copy = page(
    "<p>Recharge your skin overnight. P.S. a postscript from our founder: stay attentive. Klaviyo-style emails, meta descriptions and a yotpo of nothing.</p>",
  );
  assert.deepEqual(detectTools(copy), []);
});

test("Shopify is confirmed by the catalog, a response header or theme code", () => {
  assert.equal(detectPlatform({ html: page(""), headers: null, catalogFound: true }).kind, "shopify");
  assert.equal(
    detectPlatform({ html: page(""), headers: new Headers({ "x-shopid": "123" }), catalogFound: false }).kind,
    "shopify",
  );
  assert.equal(
    detectPlatform({ html: page(""), headers: new Headers({ "powered-by": "Shopify" }), catalogFound: false }).kind,
    "shopify",
  );
  assert.equal(detectPlatform({ html: page(SCRIPTS.theme), headers: null, catalogFound: false }).kind, "shopify");
});

test("Shopify file links alone mean probably Shopify, possibly custom-built", () => {
  const platform = detectPlatform({
    html: page('<img src="https://cdn.shopify.com/s/files/1/0001/products/tee.jpg">'),
    headers: null,
    catalogFound: false,
  });
  assert.equal(platform.kind, "shopify_likely");
  assert.match(platform.evidence[0], /cdn\.shopify\.com/);
});

test("no Shopify signals means another platform; an unread homepage means unknown", () => {
  assert.equal(detectPlatform({ html: page("<p>Hello</p>"), headers: new Headers(), catalogFound: false }).kind, "other");
  assert.equal(detectPlatform({ html: null, headers: null, catalogFound: false }).kind, "unknown");
});

test("evidence is a short, single-line excerpt", () => {
  const code = `${"x".repeat(500)}\n${SCRIPTS.klaviyo}\n${"y".repeat(500)}`;
  const [tool] = detectTools(code);
  assert.ok(tool.evidence.length < 260);
  assert.ok(!tool.evidence.includes("\n"));
  assert.ok(tool.evidence.startsWith("…") && tool.evidence.endsWith("…"));
});
