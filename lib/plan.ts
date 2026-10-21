import type { CatalogStats, DetectedTool, Plan, PlanStep, Platform, ToolId } from "./types";
import { VENDOR } from "./vendor";

/**
 * A pilot plan in OuterSignal's own setup steps, adjusted for what the scan found.
 * Every step cites the public page it comes from.
 */
export function buildPlan(input: {
  platform: Platform;
  tools: DetectedTool[];
  catalog: CatalogStats | null;
  homepageRead: boolean;
}): Plan {
  const { platform, tools, catalog, homepageRead } = input;
  const has = (id: ToolId) => tools.some((t) => t.id === id);
  const sms = tools.find((t) => t.category === "sms" && t.listed);
  const otherEmail = tools.find((t) => t.category === "email" && t.id !== "klaviyo");
  const klaviyo = has("klaviyo");
  const { backsearch } = VENDOR;

  const steps: PlanStep[] = [
    {
      text: `Install the OuterSignal Shopify app. It needs Shopify's ${VENDOR.minShopifyPlan} plan or higher.`,
      source: "klaviyo",
    },
  ];
  if (klaviyo) {
    steps.push(
      { text: "Connect Klaviyo with a full-access private API key.", source: "firstDay" },
      {
        text: "Create a Playbook and turn on “Run for existing members”. Connecting Klaviyo alone doesn't sync any data.",
        source: "firstDay",
      },
    );
  } else {
    steps.push({
      text: "Confirm the email platform first. OuterSignal's setup guide starts by connecting Klaviyo.",
      source: "firstDay",
    });
  }
  steps.push(
    {
      text: `Run a ${backsearch.lookback} backsearch of past customers (${backsearch.plans} plans, $${backsearch.pricePerCustomerUsd.toFixed(2)} per unique customer, ${backsearch.timing}).`,
      source: "firstDay",
    },
    {
      text: `Turn on Brand Personas once ${VENDOR.personasMinCustomers.toLocaleString("en-US")}+ customers have been processed.`,
      source: "firstDay",
    },
  );
  if (klaviyo) {
    steps.push({
      text: "Add persona as a conditional split at the top of the welcome series, post-purchase and win-back flows.",
      source: "klaviyo",
    });
  }
  if (has("meta")) {
    steps.push({ text: "Test persona lookalike audiences on Meta.", source: "klaviyo" });
  }
  steps.push({ text: "Measure the persona versions against the standard flows.", source: "klaviyo" });

  const watchOuts: string[] = [];
  if (!homepageRead) {
    watchOuts.push("The homepage blocked or timed out, so tools weren't checked. Look at the site in a browser.");
  }
  if (platform.kind === "shopify_likely") {
    watchOuts.push("This may be a custom-built storefront. Confirm how it's built and which Shopify plan it's on.");
  }
  if (otherEmail && !klaviyo) {
    watchOuts.push(
      `Email runs on ${otherEmail.name}. OuterSignal's guide is built around Klaviyo, so confirm how personas would reach ${otherEmail.name} (Playbooks can also send webhooks).`,
    );
  }
  if (has("recharge")) {
    watchOuts.push(
      "Recharge subscription renewals will look like repeat purchases. Separate them before reading repeat rates or persona results.",
    );
  }
  if (!catalog) {
    watchOuts.push("No public product list, so catalog numbers are missing and prices in the brief can't be checked.");
  } else if (catalog.capped) {
    watchOuts.push("The catalog has more than 250 products, so the counts and prices cover the first 250 only.");
  }

  const questions: string[] = [
    `Roughly how many customers do you have? Brand Personas unlock at ${VENDOR.personasMinCustomers.toLocaleString("en-US")}+ processed customers.`,
    `Which Shopify plan are you on? OuterSignal needs ${VENDOR.minShopifyPlan} or higher.`,
  ];
  if (klaviyo) questions.push("Which Klaviyo flows are live today, and who owns them?");
  else if (!otherEmail) questions.push("Which email platform do you use?");
  if (has("recharge")) questions.push("What share of your repeat orders are subscription renewals?");
  if (sms) questions.push(`Should personas shape your ${sms.name} texts as well as email?`);
  if (has("meta")) questions.push("Who runs your Meta ads, and would they test persona lookalike audiences?");

  return { steps, watchOuts, questions };
}
