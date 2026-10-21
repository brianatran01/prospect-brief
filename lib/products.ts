import type { Product } from "./types";

/** Shopify returns at most 250 products per page of /products.json. */
export const CATALOG_PAGE_SIZE = 250;

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values.map((v) => Math.round(v * 100) / 100))].sort((a, b) => a - b);
}

/** Map a Shopify storefront /products.json payload to the catalog shape the app uses. */
export function parseShopifyProducts(payload: unknown, max = CATALOG_PAGE_SIZE): Product[] | null {
  const list = (payload as { products?: unknown } | null)?.products;
  if (!Array.isArray(list)) return null;

  const products: Product[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const title = typeof raw.title === "string" ? raw.title.replace(/\s+/g, " ").trim() : "";
    if (!title) continue;

    const variants = Array.isArray(raw.variants) ? raw.variants : [];
    const prices = uniqueSorted(
      variants
        .map((v) => Number((v as { price?: unknown } | null)?.price))
        .filter((n) => Number.isFinite(n) && n > 0),
    );
    products.push({
      title,
      type: typeof raw.product_type === "string" && raw.product_type.trim() ? raw.product_type.trim() : undefined,
      prices,
    });
    if (products.length >= max) break;
  }
  return products;
}

export function formatPrice(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

/** "45.00" or "89.00–120.00", as shown to the model. */
export function priceRange(prices: number[]): string {
  if (!prices.length) return "price not listed";
  const low = prices[0];
  const high = prices[prices.length - 1];
  return low === high ? low.toFixed(2) : `${low.toFixed(2)}–${high.toFixed(2)}`;
}
