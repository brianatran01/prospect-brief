import { test } from "node:test";
import assert from "node:assert/strict";
import type { Brief } from "../lib/types";
import { checkBrief } from "../lib/grounding";
import { SCRIPTS, cleanBrief, scanFrom } from "./helpers";

const products = [
  { title: "Classic Tee", type: "Tops", prices: [28] },
  { title: "Hoodie", type: "Tops", prices: [64, 72] },
];
const internals = scanFrom(
  [SCRIPTS.theme, SCRIPTS.klaviyo, SCRIPTS.meta].join("\n"),
  products,
  {},
  "Free shipping over $75. 100% organic cotton.",
);
const withBrief = (patch: Partial<Brief>) => ({ ...cleanBrief, ...patch });

test("a clean brief passes and marks what it verified", () => {
  const { flags, marks } = checkBrief(cleanBrief, internals);
  assert.deepEqual(flags, []);
  assert.ok(marks.angle.some((m) => m.term === "Klaviyo" && m.ok));
  assert.ok(marks.snapshot.some((m) => m.term === "$28" && m.ok));
  assert.ok(marks.talking_points.some((m) => m.term === "+47.2%" && m.ok));
});

test("naming a tool the scan didn't find is an error", () => {
  const { flags, marks } = checkBrief(
    withBrief({ talking_points: ["Pair the personas with their Attentive texts."] }),
    internals,
  );
  assert.deepEqual(
    flags.map((f) => [f.field, f.kind, f.severity]),
    [["talking_points", "unfound_tool", "error"]],
  );
  assert.ok(marks.talking_points.some((m) => m.term === "Attentive" && !m.ok));
});

test("questions may ask about tools the scan didn't find", () => {
  const { flags } = checkBrief(withBrief({ questions: ["Do you use Attentive or Postscript for texts?"] }), internals);
  assert.deepEqual(flags, []);
});

test("a case-study sentence may quote that brand's tools and numbers", () => {
  const scan = scanFrom(SCRIPTS.meta, products);
  const { flags } = checkBrief(
    withBrief({
      angle: "Personas could split this brand's welcome and win-back flows.",
      talking_points: ["Gratsi's persona-based Klaviyo emails saw a +47.2% revenue lift."],
    }),
    scan,
  );
  assert.deepEqual(flags, []);
});

test("the case-study exception doesn't apply when the store is that brand", () => {
  const gratsi = scanFrom([SCRIPTS.klaviyo, SCRIPTS.meta].join(""), products, { name: "Gratsi", host: "gratsi.com" });
  const { flags } = checkBrief(withBrief({ angle: "Gratsi already texts customers through Postscript." }), gratsi);
  assert.deepEqual(
    flags.map((f) => f.kind),
    ["unfound_tool"],
  );
});

test("prices must come from the catalog or the store's site", () => {
  const { flags } = checkBrief(
    withBrief({ snapshot: "Tees at $28, free shipping over $75, and a bundle at $99." }),
    internals,
  );
  assert.deepEqual(
    flags.map((f) => [f.kind, f.message]),
    [["unverified_price", "Snapshot: $99 isn't a price in the store's catalog or on its site."]],
  );
});

test("percentages and multipliers must come from case studies or the store's own words", () => {
  const { flags } = checkBrief(
    withBrief({
      snapshot: "Brand sells 100% organic cotton basics.",
      angle: "Persona emails could lift revenue 30% and return 3x on ad spend.",
    }),
    internals,
  );
  assert.deepEqual(
    flags.map((f) => [f.field, f.kind]),
    [
      ["angle", "unverified_stat"],
      ["angle", "unverified_stat"],
    ],
  );
});

test("fields over their word limit get a warning, not an error", () => {
  const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
  const { flags } = checkBrief(withBrief({ snapshot: long }), internals);
  assert.deepEqual(
    flags.map((f) => [f.field, f.kind, f.severity]),
    [["snapshot", "length", "warning"]],
  );
});
