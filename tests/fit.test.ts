import { test } from "node:test";
import assert from "node:assert/strict";
import type { Platform } from "../lib/types";
import { catalogStats } from "../lib/catalog";
import { detectTools } from "../lib/detect";
import { scoreFit } from "../lib/fit";
import { buildPlan } from "../lib/plan";
import { SCRIPTS } from "./helpers";

const shopify: Platform = { kind: "shopify", evidence: ["Public product list at /products.json"] };
const toolsFrom = (...scripts: string[]) => detectTools(scripts.join("\n"));
const fit = (platform: Platform, scripts: string[], homepageRead = true) =>
  scoreFit({ platform, tools: toolsFrom(...scripts), homepageRead });

test("a store that isn't on Shopify is not a fit yet", () => {
  const result = fit({ kind: "other", evidence: [] }, [SCRIPTS.klaviyo]);
  assert.equal(result.rating, "not_yet");
  assert.match(result.reasons[0].text, /Shopify app/);
});

test("Shopify plus Klaviyo is a good fit; two more integrations make it strong", () => {
  const good = fit(shopify, [SCRIPTS.klaviyo]);
  assert.equal(good.rating, "good");
  assert.equal(good.score, 3);

  const strong = fit(shopify, [SCRIPTS.klaviyo, SCRIPTS.attentive, SCRIPTS.meta]);
  assert.equal(strong.rating, "strong");
  assert.equal(strong.score, 5);
  assert.ok(strong.reasons.some((r) => r.effect === "plus" && /Attentive/.test(r.text)));
});

test("another email platform lowers the score and says why", () => {
  const result = fit(shopify, [SCRIPTS.omnisend, SCRIPTS.yotpo]);
  assert.equal(result.rating, "possible");
  assert.equal(result.score, 0);
  assert.ok(result.reasons.some((r) => r.effect === "minus" && /Omnisend, not Klaviyo/.test(r.text)));
});

test("a probably-Shopify store gets a reason to confirm the setup", () => {
  const result = fit({ kind: "shopify_likely", evidence: ["Loads files from cdn.shopify.com"] }, [SCRIPTS.klaviyo]);
  assert.equal(result.rating, "good");
  assert.equal(result.reasons[0].effect, "neutral");
  assert.match(result.reasons[0].text, /custom-built/);
});

test("an unreadable homepage can't rate above possible", () => {
  const result = fit(shopify, [], false);
  assert.equal(result.rating, "possible");
  assert.ok(result.reasons.some((r) => /weren't checked/.test(r.text)));
});

test("the pilot plan follows OuterSignal's setup steps and adapts to the stack", () => {
  const tools = toolsFrom(SCRIPTS.klaviyo, SCRIPTS.meta, SCRIPTS.recharge, SCRIPTS.attentive);
  const plan = buildPlan({ platform: shopify, tools, catalog: null, homepageRead: true });
  const steps = plan.steps.map((s) => s.text).join("\n");
  assert.match(steps, /Grow plan or higher/);
  assert.match(steps, /Run for existing members/);
  assert.match(steps, /conditional split at the top of the welcome series, post-purchase and win-back flows/);
  assert.match(steps, /lookalike audiences on Meta/);
  assert.match(steps, /6–12 month backsearch/);
  assert.match(steps, /\$0\.03 per unique customer/);
  assert.ok(plan.steps.every((s) => ["app", "klaviyo", "firstDay"].includes(s.source)));
  assert.ok(plan.watchOuts.some((w) => /Recharge subscription renewals/.test(w)));
  assert.ok(plan.watchOuts.some((w) => /No public product list/.test(w)));
  assert.ok(plan.questions.some((q) => /subscription renewals/.test(q)));
  assert.ok(plan.questions.some((q) => /Attentive texts/.test(q)));
  assert.ok(plan.questions.some((q) => /1,000\+ processed customers/.test(q)));
});

test("without Klaviyo, the plan starts by confirming the email platform", () => {
  const tools = toolsFrom(SCRIPTS.omnisend);
  const plan = buildPlan({ platform: shopify, tools, catalog: null, homepageRead: true });
  const steps = plan.steps.map((s) => s.text).join("\n");
  assert.match(steps, /Confirm the email platform first/);
  assert.doesNotMatch(steps, /Run for existing members/);
  assert.ok(plan.watchOuts.some((w) => /Omnisend/.test(w) && /webhooks/.test(w)));
});

test("catalog stats skip gift cards and use a real price for the typical product", () => {
  const stats = catalogStats(
    [
      { title: "Classic Tee", type: "Tops", prices: [10] },
      { title: "Hoodie", type: "Tops", prices: [20, 30] },
      { title: "Weekender Bag", type: "Bags", prices: [40] },
      { title: "Gift Card", type: "Gift Card", prices: [25, 500] },
      { title: "Sticker", prices: [] },
    ],
    false,
  );
  assert.equal(stats.count, 5);
  assert.equal(stats.minPrice, 10);
  assert.equal(stats.medianPrice, 20);
  assert.equal(stats.maxPrice, 40);
  assert.deepEqual(stats.topTypes, [
    { type: "Tops", count: 2 },
    { type: "Bags", count: 1 },
  ]);
});
