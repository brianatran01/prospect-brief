import type { ScanResult, ToolCategory } from "./types";
import { CATEGORIES, CATEGORY_LABELS } from "./types";

const PLATFORM_LABELS: Record<ScanResult["platform"]["kind"], string> = {
  shopify: "Shopify",
  shopify_likely: "Likely Shopify (custom storefront?)",
  other: "Not Shopify",
  unknown: "Unknown",
};

/**
 * One CSV cell. Quotes when needed, and defuses values that a spreadsheet would run
 * as a formula (a store's name comes from its own site, so it's untrusted).
 */
export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function scansToCsv(scans: ScanResult[]): string {
  const header = [
    "Store",
    "Website",
    "Fit",
    "Score",
    "Platform",
    ...CATEGORIES.map((c) => CATEGORY_LABELS[c]),
    "OuterSignal integrations found",
    "Products",
    "Lowest price",
    "Typical price",
    "Highest price",
    "Watch-outs",
  ];
  const rows = scans.map((s) => {
    const byCategory = (c: ToolCategory) =>
      s.tools
        .filter((t) => t.category === c)
        .map((t) => t.name)
        .join("; ");
    const catalog = s.catalog;
    return [
      s.name,
      s.url,
      s.fit.label,
      s.fit.score,
      PLATFORM_LABELS[s.platform.kind],
      ...CATEGORIES.map(byCategory),
      s.tools.filter((t) => t.listed).length,
      catalog ? `${catalog.count}${catalog.capped ? "+" : ""}` : "",
      catalog?.minPrice ?? "",
      catalog?.medianPrice ?? "",
      catalog?.maxPrice ?? "",
      s.plan.watchOuts.join(" "),
    ];
  });
  // A byte-order mark so Excel opens it as UTF-8.
  return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
