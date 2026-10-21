import type { Brief, BriefField, CheckResult, Flag, FlagKind, Mark, ScanInternals } from "./types";
import { BRIEF_FIELDS } from "./types";
import { normalize } from "./text";
import { TOOLS, TOOL_ALIASES } from "./signatures";
import { CASE_STUDY_BRANDS, VENDOR_DOLLARS, VENDOR_MULTIPLIERS, VENDOR_PERCENTS } from "./vendor";

/**
 * The fact check. Plain code, not another model: it should be cheap, repeatable and
 * impossible to argue with. A brief may only name tools the scan found, quote prices
 * from the catalog, and quote percentages from OuterSignal's own case studies.
 */

export const WORD_LIMITS = { snapshot: 50, angle: 45, point: 30, why: 25, question: 25, opener: 35 } as const;

type Piece = {
  field: BriefField;
  label: string;
  text: string;
  /** The part whose length is limited (a persona's reason, not its name). */
  measured: string;
  limit: number;
  /** Questions may ask about tools the scan didn't find. */
  isQuestion: boolean;
};

function piecesOf(brief: Brief): Piece[] {
  const piece = (field: BriefField, label: string, text: string, limit: number, measured = text, isQuestion = false) => ({
    field,
    label,
    text,
    measured,
    limit,
    isQuestion,
  });
  return [
    piece("snapshot", "Snapshot", brief.snapshot, WORD_LIMITS.snapshot),
    piece("angle", "Why OuterSignal fits", brief.angle, WORD_LIMITS.angle),
    ...brief.talking_points.map((t, i) => piece("talking_points", `Talking point ${i + 1}`, t, WORD_LIMITS.point)),
    ...brief.persona_guesses.map((g, i) =>
      piece("persona_guesses", `Persona guess ${i + 1}`, `${g.name}. ${g.why}`, WORD_LIMITS.why, g.why),
    ),
    ...brief.questions.map((q, i) => piece("questions", `Question ${i + 1}`, q, WORD_LIMITS.question, q, true)),
    piece("opener", "Opening line", brief.opener, WORD_LIMITS.opener),
  ];
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const words = (s: string) => (s.match(/\S+/g) ?? []).length;
const sentencesOf = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean);
const same = (a: number, b: number) => Math.abs(a - b) < 0.005;

const PRICE_PATTERN = /[$£€]\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\+?/g;
const PERCENT_PATTERN = /[+-]?\d+(?:\.\d+)?\s?%/g;
const MULTIPLIER_PATTERN = /\b\d+(?:\.\d+)?\s?[x×](?![a-z])\+?/gi;

/** Numbers matched by a pattern, as plain values ("+47.2%" → 47.2, "$1,200" → 1200). */
function numbersIn(text: string, pattern: RegExp): number[] {
  return [...text.matchAll(pattern)].map((m) => Math.abs(Number((m[1] ?? m[0]).replace(/[^\d.]/g, ""))));
}

export function checkBrief(brief: Brief, { scan, siteText, products }: ScanInternals): CheckResult {
  const flags: Flag[] = [];
  const marks = Object.fromEntries(BRIEF_FIELDS.map((f) => [f, [] as Mark[]])) as Record<BriefField, Mark[]>;
  const found = new Set(scan.tools.map((t) => t.id));

  // The store's own words count as a source too: "100% cotton" in a product title, "$75" on the homepage.
  const storeText = [scan.description, siteText, ...products.map((p) => p.title)].join("\n");

  const knownPrices = [
    ...products.flatMap((p) => p.prices),
    ...[scan.catalog?.minPrice, scan.catalog?.medianPrice, scan.catalog?.maxPrice].filter((n): n is number => n != null),
    ...numbersIn(storeText, PRICE_PATTERN),
    ...VENDOR_DOLLARS,
  ];
  const storePercents = numbersIn(storeText, PERCENT_PATTERN);
  const storeMultipliers = numbersIn(storeText, MULTIPLIER_PATTERN);

  // A sentence about a case-study brand may quote that brand's results and tools,
  // unless the store being scanned is that brand.
  const storeKey = normalize(`${scan.name} ${scan.host}`).replace(/\s+/g, "");
  const otherCaseStudies = CASE_STUDY_BRANDS.filter((b) => !storeKey.includes(normalize(b).replace(/\s+/g, "")));
  const aboutCaseStudy = (sentence: string) => {
    const key = normalize(sentence).replace(/\s+/g, "");
    return otherCaseStudies.some((b) => key.includes(normalize(b).replace(/\s+/g, "")));
  };

  for (const piece of piecesOf(brief)) {
    const flag = (kind: FlagKind, severity: Flag["severity"], message: string) =>
      flags.push({ field: piece.field, kind, severity, message });
    const mark = (term: string, ok: boolean, note: string) => {
      if (term.trim()) marks[piece.field].push({ term, ok, note });
    };

    // 1. Tools: only ones the scan found, outside questions and case-study sentences.
    for (const sentence of sentencesOf(piece.text)) {
      if (piece.isQuestion || aboutCaseStudy(sentence)) continue;
      for (const tool of TOOLS) {
        const alias = TOOL_ALIASES[tool.id].find((a) => new RegExp(`\\b${escapeRegExp(a)}\\b`).test(sentence));
        if (!alias) continue;
        if (found.has(tool.id)) {
          mark(alias, true, "Found in the store's page code");
        } else {
          mark(alias, false, "Not found in the store's page code");
          flag("unfound_tool", "error", `${piece.label} names ${alias}, but the scan didn't find ${tool.name} on the site.`);
        }
      }
    }

    // 2. Prices: from the catalog (or OuterSignal's published figures).
    for (const m of piece.text.matchAll(PRICE_PATTERN)) {
      const value = Number(m[1].replace(/,/g, ""));
      if (knownPrices.some((p) => same(p, value))) {
        mark(m[0], true, "A price in the store's catalog or on its site");
      } else {
        mark(m[0], false, "Not a price in the store's catalog or on its site");
        flag("unverified_price", "error", `${piece.label}: ${m[0]} isn't a price in the store's catalog or on its site.`);
      }
    }

    // 3. Percentages and multipliers: from OuterSignal's case studies or the store's own words.
    const stats: [RegExp, number[], number[]][] = [
      [PERCENT_PATTERN, VENDOR_PERCENTS, storePercents],
      [MULTIPLIER_PATTERN, VENDOR_MULTIPLIERS, storeMultipliers],
    ];
    for (const [pattern, vendor, store] of stats) {
      for (const m of piece.text.matchAll(pattern)) {
        const value = Math.abs(Number(m[0].replace(/[^\d.]/g, "")));
        if (vendor.some((a) => same(a, value))) {
          mark(m[0], true, "From OuterSignal's published case studies");
        } else if (store.some((a) => same(a, value))) {
          mark(m[0], true, "Appears on the store's site or in its catalog");
        } else {
          mark(m[0], false, "Not from the store's site or OuterSignal's case studies");
          flag(
            "unverified_stat",
            "error",
            `${piece.label}: ${m[0].trim()} doesn't come from the store's site or OuterSignal's published case studies.`,
          );
        }
      }
    }

    // 4. Length.
    const n = words(piece.measured);
    if (n > piece.limit) flag("length", "warning", `${piece.label} is ${n} words; keep it to ${piece.limit} or fewer.`);
  }

  return { flags, marks };
}
