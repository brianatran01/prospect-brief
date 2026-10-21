import type { CatalogStats, Product } from "./types";

/** Gift cards list every denomination ($25 to $500), which would distort the price range. */
const isGiftCard = (p: Product) => /\bgift ?cards?\b|\be-?gift\b/i.test(`${p.title} ${p.type ?? ""}`);

export function catalogStats(products: Product[], capped: boolean): CatalogStats {
  const priced = products.filter((p) => p.prices.length > 0 && !isGiftCard(p));
  const lows = priced.map((p) => p.prices[0]).sort((a, b) => a - b);
  const highs = priced.map((p) => p.prices[p.prices.length - 1]);

  const typeCounts = new Map<string, number>();
  for (const p of products) {
    if (p.type && !isGiftCard(p)) typeCounts.set(p.type, (typeCounts.get(p.type) ?? 0) + 1);
  }
  const topTypes = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([type, count]) => ({ type, count }));

  return {
    count: products.length,
    capped,
    minPrice: lows.length ? lows[0] : null,
    // The lower middle value, so the "typical" price is always one the store really charges.
    medianPrice: lows.length ? lows[Math.floor((lows.length - 1) / 2)] : null,
    maxPrice: highs.length ? Math.max(...highs) : null,
    topTypes,
  };
}
