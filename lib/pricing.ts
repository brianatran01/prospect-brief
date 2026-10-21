// USD per million tokens, from https://platform.claude.com/docs/en/models/overview (checked October 2026).
// For other models, set PRICE_INPUT_PER_MTOK and PRICE_OUTPUT_PER_MTOK.
const RATES: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const envInput = Number(process.env.PRICE_INPUT_PER_MTOK);
  const envOutput = Number(process.env.PRICE_OUTPUT_PER_MTOK);
  const override = envInput > 0 && envOutput > 0 ? { input: envInput, output: envOutput } : undefined;
  const rate = override ?? RATES[model];
  if (!rate) return null;
  return (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;
}
