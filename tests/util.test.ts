import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, scansToCsv } from "../lib/csv";
import { briefMarkdown } from "../lib/markdown";
import { MAX_STORES, parseStoreList, storeKey } from "../lib/urls";
import { SCRIPTS, cleanBrief, scanFrom } from "./helpers";

test("parses pasted stores, removing duplicates and junk", () => {
  const { stores, skipped, truncated } = parseStoreList(
    "Gratsi.com\nhttps://www.gratsi.com/collections/all, mizzenandmain.com;  hello  ftp://files.example.com",
  );
  assert.deepEqual(stores, ["gratsi.com", "mizzenandmain.com"]);
  assert.deepEqual(skipped, ["hello", "ftp://files.example.com"]);
  assert.equal(truncated, false);
});

test("caps a pasted list at the maximum", () => {
  const list = Array.from({ length: MAX_STORES + 5 }, (_, i) => `store${i}.com`).join("\n");
  const { stores, truncated } = parseStoreList(list);
  assert.equal(stores.length, MAX_STORES);
  assert.equal(truncated, true);
});

test("store keys are lowercase hostnames without www", () => {
  assert.equal(storeKey("HTTPS://WWW.Brand.com/products/tee?x=1"), "brand.com");
  assert.equal(storeKey("brand.com)."), "brand.com");
  assert.equal(storeKey("intranet"), null);
  assert.equal(storeKey("mailto:hi@brand.com"), null);
});

test("CSV cells are quoted when needed and formulas are defused", () => {
  assert.equal(csvCell("Plain"), "Plain");
  assert.equal(csvCell('Say "hi", then go'), '"Say ""hi"", then go"');
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(12.5), "12.5");
});

test("the CSV has one row per store with its stack", () => {
  const { scan } = scanFrom([SCRIPTS.theme, SCRIPTS.klaviyo, SCRIPTS.attentive].join(""), [
    { title: "Classic Tee", prices: [28] },
  ]);
  const lines = scansToCsv([scan]).replace(/^﻿/, "").trim().split("\r\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^Store,Website,Fit,Score,Platform,Email,SMS,/);
  assert.match(lines[1], /^Brand,https:\/\/brand\.com,Good fit,4,Shopify,Klaviyo,Attentive,/);
});

test("the Markdown brief includes the plan, questions and sources", () => {
  const { scan } = scanFrom([SCRIPTS.theme, SCRIPTS.klaviyo].join(""), [{ title: "Classic Tee", prices: [28] }]);
  const md = briefMarkdown(scan, cleanBrief);
  assert.match(md, /^# Brand: call prep/);
  assert.match(md, /## Talking points/);
  assert.match(md, /## Pilot plan\n\n1\. Install the OuterSignal Shopify app/);
  assert.match(md, /## Questions to ask[\s\S]*Which products do first-time buyers start with\?/);
  assert.match(md, /\(https:\/\/apps\.shopify\.com\/famous-tracker\)/);
  assert.doesNotMatch(briefMarkdown(scan, null), /## Talking points/);
});
