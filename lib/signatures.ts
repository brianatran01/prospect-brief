import type { ToolCategory, ToolId } from "./types";

export type ToolDef = {
  id: ToolId;
  name: string;
  category: ToolCategory;
  /**
   * Patterns that only this tool's code would leave in a page: script domains,
   * global variables, config keys. Plain words like "recharge" or "postscript" are
   * deliberately not enough, because they show up in ordinary marketing copy.
   */
  patterns: RegExp[];
};

export const TOOLS: ToolDef[] = [
  {
    id: "klaviyo",
    name: "Klaviyo",
    category: "email",
    patterns: [/static\.klaviyo\.com/i, /\ba\.klaviyo\.com/i, /\bklaviyo(?:\.min)?\.js\b/i, /\b_learnq\b/],
  },
  {
    id: "omnisend",
    name: "Omnisend",
    category: "email",
    patterns: [/omnisnippet1\.com/i, /omnisrc\.com/i, /\bomnisend(?:\.com)?\b/i],
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    category: "email",
    patterns: [/chimpstatic\.com/i, /\blist-manage\.com\b/i],
  },
  {
    id: "attentive",
    name: "Attentive",
    category: "sms",
    patterns: [/cdn\.attn\.tv/i, /\battn\.tv\//i, /\b__attentive\b/],
  },
  {
    id: "postscript",
    name: "Postscript",
    category: "sms",
    patterns: [/sdk\.postscript\.io/i, /\bpostscript\.io\b/i],
  },
  {
    id: "gorgias",
    name: "Gorgias",
    category: "support",
    patterns: [/config\.gorgias\.chat/i, /\bgorgias\.chat\b/i, /\bgorgias-chat/i, /\bgorgias\.(?:io|help)\b/i],
  },
  {
    id: "yotpo",
    name: "Yotpo",
    category: "reviews",
    patterns: [/\byotpo\.com\b/i, /\bstaticw2\.yotpo/i],
  },
  {
    id: "recharge",
    name: "Recharge",
    category: "subscriptions",
    patterns: [/rechargecdn\.com/i, /rechargeapps\.com/i, /rechargepayments\.com/i],
  },
  {
    id: "meta",
    name: "Meta Pixel",
    category: "ads",
    patterns: [/connect\.facebook\.net\/[^"'\s]*fbevents\.js/i, /\bfbq\(\s*['"]init/i, /facebook_pixel/i],
  },
];

export const TOOL_BY_ID = Object.fromEntries(TOOLS.map((t) => [t.id, t])) as Record<ToolId, ToolDef>;

/** Words the brief might use for each tool, for the fact check. "Meta Pixel" is often just "Meta". */
export const TOOL_ALIASES: Record<ToolId, string[]> = {
  klaviyo: ["Klaviyo"],
  omnisend: ["Omnisend"],
  mailchimp: ["Mailchimp"],
  attentive: ["Attentive"],
  postscript: ["Postscript"],
  gorgias: ["Gorgias"],
  yotpo: ["Yotpo"],
  recharge: ["Recharge", "ReCharge"],
  meta: ["Meta Pixel", "Meta", "Facebook", "Instagram"],
};
