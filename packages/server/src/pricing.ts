/**
 * Best-effort token pricing for usage events.
 *
 * Prices are USD per 1 million tokens, sourced from OpenRouter's public pricing
 * (as of mid-2026). LM Studio is local and therefore always free ($0).
 *
 * This is deliberately a small static table — the AI SDK does not expose
 * provider pricing on LanguageModelV1. Unknown models return `undefined`
 * (cost is omitted from the usage event rather than guessed).
 */

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

// USD per 1M tokens: { input, output }
const OPENROUTER_PRICES: Record<string, { input: number; output: number }> = {
  'anthropic/claude-sonnet-4-5': { input: 3, output: 15 },
  'anthropic/claude-opus-4': { input: 15, output: 75 },
  'openai/gpt-4o': { input: 2.5, output: 10 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.6 },
  'google/gemini-2.5-pro': { input: 1.25, output: 10 },
  'google/gemini-2.5-flash': { input: 0.3, output: 2.5 },
};

/**
 * Estimate the USD cost of a turn.
 * Returns `undefined` when the model is unknown (no price data).
 */
export function estimateCost(
  provider: string,
  model: string,
  usage: TokenUsage,
): number | undefined {
  // Local inference costs nothing
  if (provider === 'lmstudio') return 0;

  const price = OPENROUTER_PRICES[model];
  if (!price) return undefined;

  return (
    (usage.promptTokens * price.input + usage.completionTokens * price.output) /
    1_000_000
  );
}
