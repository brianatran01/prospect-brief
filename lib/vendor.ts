import type { SourceKey, ToolId } from "./types";

/**
 * Everything the app knows about OuterSignal, in one place, from its public pages
 * (checked October 2026). The fit rules, the pilot plan and the brief all read from
 * here, so when OuterSignal changes a plan or adds an integration, this is the only
 * file to update.
 */

export const SOURCES: Record<SourceKey, { label: string; url: string }> = {
  app: {
    label: "OuterSignal on the Shopify App Store",
    url: "https://apps.shopify.com/famous-tracker",
  },
  klaviyo: {
    label: "OuterSignal + Klaviyo email personalization",
    url: "https://www.outersignal.com/blog/outersignal-klaviyo-email-personalization.html",
  },
  firstDay: {
    label: "Your first day in OuterSignal",
    url: "https://docs.outersignal.com/en/articles/15545118-your-first-day-in-outersignal",
  },
};

export const VENDOR = {
  name: "OuterSignal",
  /** The "Works with" list on the App Store page, plus Meta from its feature list. */
  integrations: ["klaviyo", "postscript", "attentive", "gorgias", "yotpo", "recharge", "meta"] as ToolId[],
  minShopifyPlan: "Grow",
  personasMinCustomers: 1000,
  backsearch: {
    plans: "Pro and Enterprise",
    lookback: "6–12 month",
    pricePerCustomerUsd: 0.03,
    timing: "typically 24 hours for up to 5,000 customers",
  },
  caseStudies: [
    {
      brand: "Gratsi",
      summary: "Persona-based emails saw a +47.2% revenue lift and a +54.1% click rate increase over their standard flows.",
      source: "klaviyo" as SourceKey,
    },
  ],
};

/**
 * Numbers the brief may quote without a catalog behind them: they come from
 * OuterSignal's own published pages above.
 */
export const VENDOR_PERCENTS = [47.2, 54.1];
export const VENDOR_MULTIPLIERS: number[] = [];
export const VENDOR_DOLLARS = [0.03];
export const CASE_STUDY_BRANDS = VENDOR.caseStudies.map((c) => c.brand);

export const isListedIntegration = (id: ToolId) => VENDOR.integrations.includes(id);
