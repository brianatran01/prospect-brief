const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  trade: "™",
  reg: "®",
  copy: "©",
  deg: "°",
};

/** Decode HTML entities in a single pass, so "&amp;lt;" becomes "&lt;" rather than "<". */
export function decodeEntities(input: string): string {
  return input.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (match, code: string) => {
    if (code.startsWith("#")) {
      const isHex = code[1] === "x" || code[1] === "X";
      const n = isHex ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Lowercase, strip accents and punctuation. Every catalog comparison goes through this. */
export function normalize(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Readable text from a page: drop scripts, styles and markup, keep one line per block, skip repeats. */
export function htmlToText(html: string): string {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1\s*>/gi, " ");
  const withBreaks = withoutNoise
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|h[1-6]|header|footer|nav|tr|td|blockquote|figcaption|button|a)\s*>/gi, "\n");
  const text = decodeEntities(withBreaks.replace(/<[^>]+>/g, " "));

  const seen = new Set<string>();
  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 2) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
  }
  return lines.join("\n");
}

export function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = match ? decodeEntities(match[1]).replace(/\s+/g, " ").trim() : "";
  return title || undefined;
}

/** Read a <meta name="..."> or <meta property="..."> content value, in either attribute order. */
export function extractMeta(html: string, key: string): string | undefined {
  const wanted = key.toLowerCase();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs: Record<string, string> = {};
    for (const attr of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attrs[attr[1].toLowerCase()] = attr[2] ?? attr[3] ?? "";
    }
    const named = attrs.name?.toLowerCase() === wanted || attrs.property?.toLowerCase() === wanted;
    if (named && attrs.content) {
      const value = decodeEntities(attrs.content).replace(/\s+/g, " ").trim();
      if (value) return value;
    }
  }
  return undefined;
}

/** Shorten text at a word boundary. */
export function clip(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max).replace(/\s+\S*$/, "")}…`;
}
