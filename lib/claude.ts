import Anthropic from "@anthropic-ai/sdk";
import type { Brief, RunStats, ScanInternals } from "./types";
import { toBrief } from "./brief";
import { HttpError } from "./http";
import { estimateCostUsd } from "./pricing";
import { BRIEF_SCHEMA, SYSTEM_PROMPT, buildUserPrompt } from "./prompt";

export const DEFAULT_MODEL = "claude-sonnet-5-5";
const EFFORTS = ["low", "medium", "high"] as const;
type Effort = (typeof EFFORTS)[number];

export function modelSettings(): { model: string; effort: Effort } {
  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
  const requested = process.env.ANTHROPIC_EFFORT?.trim().toLowerCase() ?? "";
  const effort = EFFORTS.find((e) => e === requested) ?? "medium";
  return { model, effort };
}

/** Fail before scanning anything when there's no key to write the brief with. */
export function requireApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new HttpError(
      500,
      "ANTHROPIC_API_KEY isn't set. Add it to .env.local (or your Vercel project's environment variables) and restart.",
    );
  }
  return apiKey;
}

/**
 * One Claude call per brief. Structured outputs (output_config.format) constrain the
 * reply to BRIEF_SCHEMA, so it always parses into the same shape. Forced tool use
 * isn't an option here: Claude Sonnet 5.5 rejects tool_choice "tool".
 */
export async function generateBrief(input: ScanInternals): Promise<{ brief: Brief; stats: RunStats }> {
  const apiKey = requireApiKey();
  const { model, effort } = modelSettings();
  const client = new Anthropic({ apiKey, maxRetries: 2 });
  const started = Date.now();

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model,
      // Thinking counts toward max_tokens, so leave room beyond the ~600-token brief.
      max_tokens: 6_000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
      output_config: { effort, format: { type: "json_schema", schema: BRIEF_SCHEMA } },
    });
  } catch (err) {
    throw toHttpError(err, model);
  }
  const latencyMs = Date.now() - started;

  if (response.stop_reason === "refusal") {
    throw new HttpError(422, "Claude declined to write this brief. Try another store.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new HttpError(502, "The brief was cut off before it finished. Try again, or set ANTHROPIC_EFFORT=low.");
  }

  const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(502, "Claude's reply wasn't valid JSON. Try again.");
  }

  const { input_tokens: inputTokens, output_tokens: outputTokens } = response.usage;
  return {
    brief: toBrief(parsed),
    stats: {
      model,
      effort,
      inputTokens,
      outputTokens,
      costUsd: estimateCostUsd(model, inputTokens, outputTokens),
      latencyMs,
    },
  };
}

function toHttpError(err: unknown, model: string): HttpError {
  if (err instanceof Anthropic.APIConnectionError) {
    return new HttpError(503, "Couldn't reach the Anthropic API. Check your connection and try again.");
  }
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 502;
    if (status === 401) return new HttpError(502, "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.");
    if (status === 404) return new HttpError(502, `The model "${model}" wasn't found. Check ANTHROPIC_MODEL.`);
    if (status === 429) return new HttpError(429, "Hit the Anthropic rate limit. Wait a minute and try again.");
    if (status === 529 || status >= 500) return new HttpError(503, "The Anthropic API is busy right now. Try again in a moment.");
    return new HttpError(502, `The Anthropic API rejected the request: ${err.message}`);
  }
  return new HttpError(500, err instanceof Error ? err.message : "Unknown error calling Claude.");
}
