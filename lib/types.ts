/** A product from the store's public catalog. Prices are in the store's currency. */
export type Product = {
  title: string;
  type?: string;
  prices: number[];
};

export const TOOL_IDS = [
  "klaviyo",
  "omnisend",
  "mailchimp",
  "attentive",
  "postscript",
  "gorgias",
  "yotpo",
  "recharge",
  "meta",
] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export const CATEGORIES = ["email", "sms", "support", "reviews", "subscriptions", "ads"] as const;
export type ToolCategory = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  email: "Email",
  sms: "SMS",
  support: "Support",
  reviews: "Reviews",
  subscriptions: "Subscriptions",
  ads: "Ads",
};

export type DetectedTool = {
  id: ToolId;
  name: string;
  category: ToolCategory;
  /** On OuterSignal's published integration list. */
  listed: boolean;
  /** The bit of page code around the match, so a person can check it. */
  evidence: string;
  /** The exact text that matched, highlighted inside the evidence. */
  match: string;
};

/**
 * shopify: confirmed by the public catalog, a Shopify response header or standard theme code.
 * shopify_likely: only Shopify file links, which can mean a custom-built storefront.
 * other: the homepage was read and nothing points to Shopify.
 * unknown: the homepage couldn't be read and there's no public catalog.
 */
export type PlatformKind = "shopify" | "shopify_likely" | "other" | "unknown";

export type Platform = {
  kind: PlatformKind;
  evidence: string[];
};

export type CatalogStats = {
  /** Products read from the first page of /products.json. */
  count: number;
  /** True when the page was full, so the store probably has more products. */
  capped: boolean;
  minPrice: number | null;
  /** The middle product's lowest price, so it's always a real catalog price. */
  medianPrice: number | null;
  maxPrice: number | null;
  topTypes: { type: string; count: number }[];
};

export type FitRating = "strong" | "good" | "possible" | "not_yet";

export type FitReason = { effect: "plus" | "minus" | "neutral"; text: string };

export type Fit = {
  rating: FitRating;
  label: string;
  /** Sum of the rule points, used to sort stores with the same rating. */
  score: number;
  reasons: FitReason[];
};

export type SourceKey = "app" | "klaviyo" | "firstDay";

export type PlanStep = { text: string; source: SourceKey };

export type Plan = {
  steps: PlanStep[];
  watchOuts: string[];
  questions: string[];
};

/** What the browser sees for one store. */
export type ScanResult = {
  url: string;
  host: string;
  name: string;
  description: string;
  homepageRead: boolean;
  platform: Platform;
  tools: DetectedTool[];
  catalog: CatalogStats | null;
  fit: Fit;
  plan: Plan;
  notes: string[];
  scannedAt: string;
};

/** The scan plus the material only the server keeps: site copy and the full product list. */
export type ScanInternals = {
  scan: ScanResult;
  siteText: string;
  products: Product[];
};

export type PersonaGuess = { name: string; why: string };

export type Brief = {
  snapshot: string;
  angle: string;
  talking_points: string[];
  persona_guesses: PersonaGuess[];
  questions: string[];
  opener: string;
};

export const BRIEF_FIELDS = ["snapshot", "angle", "talking_points", "persona_guesses", "questions", "opener"] as const;
export type BriefField = (typeof BRIEF_FIELDS)[number];

export const BRIEF_LABELS: Record<BriefField, string> = {
  snapshot: "Snapshot",
  angle: "Why OuterSignal fits",
  talking_points: "Talking points",
  persona_guesses: "Persona guesses to test",
  questions: "Questions for this store",
  opener: "Opening line",
};

export type FlagKind = "unfound_tool" | "unverified_price" | "unverified_stat" | "length";

export type Flag = {
  field: BriefField;
  kind: FlagKind;
  severity: "error" | "warning";
  message: string;
};

/** A term to highlight in the brief: green if verified, red if not. */
export type Mark = { term: string; ok: boolean; note: string };

export type CheckResult = {
  flags: Flag[];
  marks: Record<BriefField, Mark[]>;
};

export type RunStats = {
  model: string;
  effort: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  latencyMs: number;
};

export type BriefResult = {
  scan: ScanResult;
  brief: Brief;
  check: CheckResult;
  stats: RunStats;
};
