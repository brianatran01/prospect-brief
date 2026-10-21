import type { Brief, ScanResult } from "./types";
import { CATEGORY_LABELS } from "./types";
import { formatPrice } from "./products";
import { SOURCES } from "./vendor";

const bullet = (s: string) => `- ${s}`;

/** The whole brief as Markdown, for pasting into a CRM note, Slack or a doc. */
export function briefMarkdown(scan: ScanResult, brief?: Brief | null): string {
  const lines: string[] = [`# ${scan.name}: call prep`, "", `${scan.url} · ${scan.fit.label}`, ""];

  if (brief) {
    lines.push("## Snapshot", "", brief.snapshot, "", "## Why OuterSignal fits", "", brief.angle, "");
    if (brief.talking_points.length) lines.push("## Talking points", "", ...brief.talking_points.map(bullet), "");
    if (brief.persona_guesses.length) {
      lines.push("## Persona guesses to test", "", ...brief.persona_guesses.map((g) => bullet(`**${g.name}.** ${g.why}`)), "");
    }
    if (brief.opener) lines.push("## Opening line", "", `> ${brief.opener}`, "");
  }

  lines.push("## Fit", "", ...scan.fit.reasons.map((r) => bullet(r.text)), "");

  lines.push("## Stack found on the homepage", "");
  if (scan.tools.length) {
    lines.push(
      ...scan.tools.map((t) =>
        bullet(`${CATEGORY_LABELS[t.category]}: ${t.name}${t.listed ? " (OuterSignal integration)" : ""}`),
      ),
    );
  } else {
    lines.push("- None of the tracked tools were found.");
  }
  lines.push("");

  const c = scan.catalog;
  if (c) {
    const prices =
      c.minPrice !== null && c.maxPrice !== null && c.medianPrice !== null
        ? `, ${formatPrice(c.minPrice)} to ${formatPrice(c.maxPrice)}, typical ${formatPrice(c.medianPrice)}`
        : "";
    lines.push("## Catalog", "", `${c.count}${c.capped ? "+" : ""} ${c.count === 1 && !c.capped ? "product" : "products"}${prices}.`, "");
  }

  lines.push("## Pilot plan", "", ...scan.plan.steps.map((s, i) => `${i + 1}. ${s.text}`), "");
  if (scan.plan.watchOuts.length) lines.push("## Watch-outs", "", ...scan.plan.watchOuts.map(bullet), "");

  const questions = [...scan.plan.questions, ...(brief?.questions ?? [])];
  lines.push("## Questions to ask", "", ...questions.map(bullet), "");

  lines.push(
    "## Sources",
    "",
    ...Object.values(SOURCES).map((s) => bullet(`[${s.label}](${s.url})`)),
    "",
    "_Tools come from the store's public homepage code. Not found doesn't mean not used._",
    "",
  );
  return lines.join("\n");
}
