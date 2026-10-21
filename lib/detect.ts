import type { DetectedTool, Platform } from "./types";
import { TOOLS } from "./signatures";
import { isListedIntegration } from "./vendor";

const EVIDENCE_PADDING = 70;

/** A short, single-line excerpt of the page code around a match. */
export function snippetAround(html: string, index: number, length: number): string {
  const start = Math.max(0, index - EVIDENCE_PADDING);
  const end = Math.min(html.length, index + length + EVIDENCE_PADDING);
  const body = html
    .slice(start, end)
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${start > 0 ? "…" : ""}${body}${end < html.length ? "…" : ""}`;
}

/** Find the marketing tools whose code appears in a page, with the evidence for each. */
export function detectTools(html: string): DetectedTool[] {
  const found: DetectedTool[] = [];
  for (const tool of TOOLS) {
    for (const pattern of tool.patterns) {
      const match = pattern.exec(html);
      if (!match) continue;
      found.push({
        id: tool.id,
        name: tool.name,
        category: tool.category,
        listed: isListedIntegration(tool.id),
        evidence: snippetAround(html, match.index, match[0].length),
        match: match[0].replace(/\s+/g, " "),
      });
      break;
    }
  }
  return found;
}

/** Signals only a standard Shopify storefront serves. */
const THEME_SIGNALS: { pattern: RegExp; label: string }[] = [
  { pattern: /\/cdn\/shop\//i, label: "Theme files served from the store's /cdn/shop/ path" },
  { pattern: /\bShopify\.shop\s*=/, label: "Sets Shopify.shop in the page code" },
];

/** Signals a custom-built storefront on Shopify can also leave. */
const ASSET_SIGNALS: { pattern: RegExp; label: string }[] = [
  { pattern: /cdn\.shopify\.com/i, label: "Loads files from cdn.shopify.com" },
  { pattern: /[a-z0-9-]+\.myshopify\.com/i, label: "Mentions a myshopify.com address" },
];

const SHOPIFY_HEADERS = ["x-shopid", "x-shardid", "x-shopify-stage", "x-sorting-hat-shopid"];

export function detectPlatform(input: {
  html: string | null;
  headers: Headers | null;
  catalogFound: boolean;
}): Platform {
  const { html, headers, catalogFound } = input;
  const strong: string[] = [];
  if (catalogFound) strong.push("Public product list at /products.json");

  const header = headers ? SHOPIFY_HEADERS.find((name) => headers.has(name)) : undefined;
  if (header) strong.push(`Shopify response header (${header})`);
  if (/shopify/i.test(headers?.get("powered-by") ?? "")) strong.push("Powered-By: Shopify response header");

  if (html) {
    for (const signal of THEME_SIGNALS) if (signal.pattern.test(html)) strong.push(signal.label);
  }
  const weak = html ? ASSET_SIGNALS.filter((s) => s.pattern.test(html)).map((s) => s.label) : [];

  if (strong.length) return { kind: "shopify", evidence: [...strong, ...weak] };
  if (weak.length) return { kind: "shopify_likely", evidence: weak };
  if (html === null) return { kind: "unknown", evidence: [] };
  return { kind: "other", evidence: [] };
}
