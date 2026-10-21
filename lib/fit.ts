import type { DetectedTool, Fit, FitReason, FitRating, Platform, ToolId } from "./types";

/**
 * Fit rules, kept deliberately simple so a salesperson can read every reason.
 * Shopify is required (OuterSignal is a Shopify app). Klaviyo matters most,
 * because OuterSignal's setup guide calls Klaviyo "how OuterSignal data becomes
 * action". Every other listed integration adds a point.
 */

export const LABELS: Record<FitRating, string> = {
  strong: "Strong fit",
  good: "Good fit",
  possible: "Possible fit",
  not_yet: "Not a fit yet",
};

export const RATING_ORDER: Record<FitRating, number> = { strong: 0, good: 1, possible: 2, not_yet: 3 };

const KLAVIYO_POINTS = 3;
const STRONG_SCORE = 5;

const EXTRA_POINT_REASONS: Partial<Record<ToolId, string>> = {
  attentive: "SMS through Attentive, an OuterSignal integration.",
  postscript: "SMS through Postscript, an OuterSignal integration.",
  gorgias: "Support through Gorgias, an OuterSignal integration.",
  yotpo: "Reviews through Yotpo, an OuterSignal integration.",
  recharge: "Subscriptions through Recharge, an OuterSignal integration.",
  meta: "Runs the Meta Pixel, so persona lookalike audiences on Meta are an option.",
};

export function scoreFit(input: { platform: Platform; tools: DetectedTool[]; homepageRead: boolean }): Fit {
  const { platform, tools, homepageRead } = input;
  const has = (id: ToolId) => tools.some((t) => t.id === id);
  const reasons: FitReason[] = [];
  let score = 0;

  if (platform.kind === "other") {
    reasons.push({ effect: "minus", text: "Not on Shopify, and OuterSignal is a Shopify app." });
    return { rating: "not_yet", label: LABELS.not_yet, score: 0, reasons };
  }
  if (platform.kind === "unknown") {
    reasons.push({ effect: "neutral", text: "The homepage couldn't be read, so the platform is unknown." });
    return { rating: "possible", label: LABELS.possible, score: 0, reasons };
  }

  if (platform.kind === "shopify") {
    reasons.push({ effect: "plus", text: "Runs on Shopify." });
  } else {
    reasons.push({
      effect: "neutral",
      text: "Uses Shopify files but not a standard Shopify storefront. It may be custom-built, so confirm the setup.",
    });
  }

  if (!homepageRead) {
    reasons.push({ effect: "neutral", text: "The homepage couldn't be read, so its tools weren't checked." });
    return { rating: "possible", label: LABELS.possible, score, reasons };
  }

  const otherEmail = tools.find((t) => t.category === "email" && t.id !== "klaviyo");
  if (has("klaviyo")) {
    score += KLAVIYO_POINTS;
    reasons.push({
      effect: "plus",
      text: "Uses Klaviyo, which OuterSignal's setup guide calls “how OuterSignal data becomes action.”",
    });
  } else if (otherEmail) {
    score -= 1;
    reasons.push({
      effect: "minus",
      text: `Email runs on ${otherEmail.name}, not Klaviyo, so check how personas would reach it.`,
    });
  } else {
    reasons.push({ effect: "neutral", text: "No email platform found in the page code. Ask what they use." });
  }

  for (const [id, text] of Object.entries(EXTRA_POINT_REASONS) as [ToolId, string][]) {
    if (has(id)) {
      score += 1;
      reasons.push({ effect: "plus", text });
    }
  }

  const rating: FitRating = has("klaviyo") ? (score >= STRONG_SCORE ? "strong" : "good") : "possible";
  return { rating, label: LABELS[rating], score, reasons };
}
