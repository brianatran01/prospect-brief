import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { scanStore } from "../lib/scan";
import { SCRIPTS, html, mockFetch } from "./helpers";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const catalog = () =>
  Response.json({
    products: [
      { title: "Classic Tee", product_type: "Tops", variants: [{ price: "28.00" }] },
      { title: "Hoodie", product_type: "Tops", variants: [{ price: "64.00" }, { price: "72.00" }] },
      { title: "Weekender Bag", product_type: "Bags", variants: [{ price: "120.00" }] },
    ],
  });

const head = '<title>Brand | Everyday basics</title><meta property="og:site_name" content="Brand Co"><meta name="description" content="Basics, made well.">';

test("scans the homepage and catalog, then scores the store", async () => {
  mockFetch({
    "https://brand.com/": () => html(`${SCRIPTS.theme}${SCRIPTS.klaviyo}<h1>Basics, made well</h1>`, head),
    "https://brand.com/products.json?limit=250": catalog,
  });
  const { scan, siteText, products } = await scanStore("brand.com");
  assert.equal(scan.name, "Brand Co");
  assert.equal(scan.host, "brand.com");
  assert.equal(scan.description, "Basics, made well.");
  assert.equal(scan.platform.kind, "shopify");
  assert.deepEqual(
    scan.tools.map((t) => t.id),
    ["klaviyo"],
  );
  assert.equal(scan.catalog?.count, 3);
  assert.equal(scan.catalog?.minPrice, 28);
  assert.equal(scan.catalog?.maxPrice, 120);
  assert.equal(scan.fit.rating, "good");
  assert.match(siteText, /Basics, made well/);
  assert.equal(products.length, 3);
});

test("follows a public redirect from the bare domain to www", async () => {
  const calls = mockFetch({
    "https://brand.com/": () => new Response(null, { status: 301, headers: { location: "https://www.brand.com/" } }),
    "https://www.brand.com/": () => html(SCRIPTS.klaviyo, head),
    "https://brand.com/products.json?limit=250": () =>
      new Response(null, { status: 301, headers: { location: "https://www.brand.com/products.json?limit=250" } }),
    "https://www.brand.com/products.json?limit=250": catalog,
  });
  const { scan } = await scanStore("https://brand.com");
  assert.equal(scan.url, "https://www.brand.com");
  assert.equal(scan.host, "brand.com");
  assert.equal(scan.catalog?.count, 3);
  assert.ok(calls.some((c) => c.url === "https://www.brand.com/"));
});

test("a blocked homepage still uses the catalog and says what's missing", async () => {
  mockFetch({
    "https://brand.com/": () => new Response("Forbidden", { status: 403 }),
    "https://brand.com/products.json?limit=250": catalog,
  });
  const { scan } = await scanStore("brand.com");
  assert.equal(scan.homepageRead, false);
  assert.equal(scan.platform.kind, "shopify");
  assert.deepEqual(scan.tools, []);
  assert.equal(scan.fit.rating, "possible");
  assert.match(scan.notes[0], /status 403 \(often bot protection\)/);
});

test("a store with no public catalog gets a note, not an error", async () => {
  mockFetch({
    "https://brand.com/": () => html(SCRIPTS.klaviyo, head),
    "https://brand.com/products.json?limit=250": () => html("<form>Enter store password</form>"),
  });
  const { scan } = await scanStore("brand.com");
  assert.equal(scan.catalog, null);
  assert.equal(scan.platform.kind, "other");
  assert.ok(scan.notes.some((n) => /products\.json/.test(n)));
});

test("fails clearly when nothing can be read", async () => {
  mockFetch({ "https://brand.com/": () => new Response("Unavailable", { status: 503 }) });
  await assert.rejects(scanStore("brand.com"), /Couldn't read brand\.com\. The homepage answered with status 503/);
});

test("refuses a redirect into a private network", async () => {
  mockFetch({
    "https://brand.com/": () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }),
  });
  await assert.rejects(scanStore("brand.com"), /private network/);
});

test("refuses private addresses before fetching anything", async () => {
  const calls = mockFetch({});
  await assert.rejects(scanStore("http://10.0.0.5"), /private network/);
  await assert.rejects(scanStore("localhost"), /private network/);
  assert.deepEqual(calls, []);
});
