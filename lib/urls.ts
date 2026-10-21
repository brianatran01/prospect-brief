export const MAX_STORES = 25;

/** "https://www.Gratsi.com/collections/all" → "gratsi.com". Null for anything that isn't a web address. */
export function storeKey(input: string): string | null {
  const trimmed = input.trim().replace(/[),.;]+$/, "");
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    // An email address pasted by mistake ("hi@brand.com") parses as a URL with a username.
    if (url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

/**
 * Turn pasted text (one store per line, or separated by commas or spaces) into a
 * de-duplicated list of store addresses. The server still validates each one.
 */
export function parseStoreList(text: string): { stores: string[]; skipped: string[]; truncated: boolean } {
  const stores: string[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  let truncated = false;

  for (const token of text.split(/[\s,;]+/)) {
    if (!token) continue;
    const key = storeKey(token);
    if (!key) {
      skipped.push(token);
      continue;
    }
    if (seen.has(key)) continue;
    if (stores.length >= MAX_STORES) {
      truncated = true;
      break;
    }
    seen.add(key);
    stores.push(key);
  }
  return { stores, skipped, truncated };
}
