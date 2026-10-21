import type { Product, ScanInternals } from "./types";
import { catalogStats } from "./catalog";
import { detectPlatform, detectTools } from "./detect";
import { fetchPublic, readCapped } from "./fetch";
import { scoreFit } from "./fit";
import { HttpError } from "./http";
import { buildPlan } from "./plan";
import { CATALOG_PAGE_SIZE, parseShopifyProducts } from "./products";
import { normalizeStoreUrl } from "./safe-url";
import { clip, extractMeta, extractTitle, htmlToText } from "./text";

export const MAX_SITE_TEXT = 4_000;

type Homepage =
  | { ok: true; html: string; headers: Headers; url: URL }
  | { ok: false; reason: string; headers: Headers | null; url: URL };

async function loadHomepage(start: URL): Promise<Homepage> {
  try {
    const { res, url } = await fetchPublic(start, "text/html,application/xhtml+xml");
    if (!res.ok) {
      const hint = res.status === 403 || res.status === 429 || res.status === 503 ? " (often bot protection)" : "";
      return { ok: false, reason: `The homepage answered with status ${res.status}${hint}.`, headers: res.headers, url };
    }
    return { ok: true, html: await readCapped(res), headers: res.headers, url };
  } catch (err) {
    // A private-network address or redirect is refused outright, not reported as a note.
    if (err instanceof HttpError && err.status === 400) throw err;
    const reason = err instanceof HttpError ? err.message : "The homepage didn't respond in time.";
    return { ok: false, reason, headers: null, url: start };
  }
}

async function loadCatalog(start: URL): Promise<Product[] | null> {
  try {
    const { res } = await fetchPublic(new URL(`/products.json?limit=${CATALOG_PAGE_SIZE}`, start.origin), "application/json");
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) return null;
    return parseShopifyProducts(JSON.parse(await readCapped(res)));
  } catch {
    // Not a Shopify store, or the endpoint is blocked. The scan notes it.
    return null;
  }
}

function storeName(html: string, url: URL): string {
  const siteName = extractMeta(html, "og:site_name") ?? extractMeta(html, "application-name");
  if (siteName && siteName.length <= 60) return siteName;
  const title = extractTitle(html);
  const firstPart = title?.split(/\s[|–—-]\s/)[0]?.trim();
  if (firstPart && firstPart.length <= 40) return firstPart;
  const label = url.hostname.replace(/^www\./, "").split(".")[0] || url.hostname;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Read one store's homepage and public catalog, then score it. Nothing here calls Claude. */
export async function scanStore(input: string): Promise<ScanInternals> {
  const start = normalizeStoreUrl(input);
  const [home, products] = await Promise.all([loadHomepage(start), loadCatalog(start)]);

  if (!home.ok && !products) {
    throw new HttpError(502, `Couldn't read ${start.hostname}. ${home.reason}`);
  }

  const html = home.ok ? home.html : null;
  const tools = html ? detectTools(html) : [];
  const platform = detectPlatform({ html, headers: home.headers, catalogFound: Boolean(products) });
  const catalog = products ? catalogStats(products, products.length >= CATALOG_PAGE_SIZE) : null;
  const homepageRead = home.ok;

  const notes: string[] = [];
  if (!home.ok) notes.push(`${home.reason} Tools weren't checked.`);
  if (!products) notes.push("No public product list at /products.json.");

  const url = home.url;
  return {
    scan: {
      url: url.origin,
      host: url.hostname.replace(/^www\./, ""),
      name: html ? storeName(html, url) : storeName("", url),
      description: html ? (extractMeta(html, "description") ?? extractMeta(html, "og:description") ?? "") : "",
      homepageRead,
      platform,
      tools,
      catalog,
      fit: scoreFit({ platform, tools, homepageRead }),
      plan: buildPlan({ platform, tools, catalog, homepageRead }),
      notes,
      scannedAt: new Date().toISOString(),
    },
    siteText: html ? clip(htmlToText(html), MAX_SITE_TEXT) : "",
    products: products ?? [],
  };
}
