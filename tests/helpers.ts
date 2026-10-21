import type { Brief, ScanInternals, ScanResult } from "../lib/types";
import { buildPlan } from "../lib/plan";
import { catalogStats } from "../lib/catalog";
import { detectPlatform, detectTools } from "../lib/detect";
import { scoreFit } from "../lib/fit";

export type Call = { url: string; body: unknown };

/**
 * Stand in for the network: store pages by exact URL, and the Anthropic API by path.
 * Records every request so tests can check what was (and wasn't) fetched.
 */
export function mockFetch(
  routes: Record<string, () => Response>,
  claude?: () => Response,
): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    let body: unknown;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    calls.push({ url, body });
    if (claude && url.endsWith("/v1/messages")) return claude();
    const handler = routes[url];
    return handler ? handler() : new Response("Not found", { status: 404 });
  }) as typeof fetch;
  return calls;
}

export const html = (body: string, head = "") =>
  new Response(`<!doctype html><html><head>${head}</head><body>${body}</body></html>`, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });

export const SCRIPTS = {
  klaviyo: '<script async src="https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=AbC123"></script>',
  attentive: '<script src="https://cdn.attn.tv/brand/dtag.js"></script>',
  postscript: '<script src="https://sdk.postscript.io/sdk.bundle.js?shopId=1234"></script>',
  gorgias: '<script src="https://config.gorgias.chat/bundle-loader/01H"></script>',
  yotpo: '<script src="https://cdn-widgetsrepository.yotpo.com/v1/loader/AbC"></script>',
  recharge: '<script src="https://static.rechargecdn.com/assets/js/widget.min.js"></script>',
  meta: "<script>!function(f,b,e,v){}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','123');</script>",
  omnisend: '<script src="https://omnisnippet1.com/inshop/launcher-v2.js"></script>',
  theme: '<link rel="stylesheet" href="//brand.com/cdn/shop/t/12/assets/base.css">',
};

/** Build a scan the way the server would, from page code and products, without any network. */
export function scanFrom(
  page: string,
  products: ScanInternals["products"],
  extra: Partial<ScanResult> = {},
  siteText = "",
): ScanInternals {
  const tools = detectTools(page);
  const platform = detectPlatform({ html: page, headers: null, catalogFound: products.length > 0 });
  const catalog = products.length ? catalogStats(products, false) : null;
  return {
    scan: {
      url: "https://brand.com",
      host: "brand.com",
      name: "Brand",
      description: "",
      homepageRead: true,
      platform,
      tools,
      catalog,
      fit: scoreFit({ platform, tools, homepageRead: true }),
      plan: buildPlan({ platform, tools, catalog, homepageRead: true }),
      notes: [],
      scannedAt: "2026-10-16T00:00:00.000Z",
      ...extra,
    },
    siteText,
    products,
  };
}

export const cleanBrief: Brief = {
  snapshot: "Brand sells everyday basics from $28 to $72, with tees and hoodies at the core.",
  angle: "Brand already runs Klaviyo, so personas can split its welcome and win-back flows on day one.",
  talking_points: [
    "Klaviyo is in place, so setup starts with a Playbook rather than a new tool.",
    "The Meta Pixel is live, so persona lookalike audiences are worth a test.",
    "Gratsi saw a +47.2% revenue lift from persona-based emails over their standard flows.",
  ],
  persona_guesses: [{ name: "The Basics Buyer", why: "The Classic Tee at $28 is the cheapest item, a natural first purchase." }],
  questions: ["Which products do first-time buyers start with?"],
  opener: "Your Classic Tee at $28 looks like the entry point for most new customers.",
};
