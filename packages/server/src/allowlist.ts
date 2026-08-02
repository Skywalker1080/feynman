import type { Config } from '@feynman/types';

export interface AllowlistResult {
  /** Whether the model is on the tested allowlist */
  allowed: boolean;
  /**
   * Human-readable disclaimer if model is not on the allowlist.
   * Only present when allowed === false.
   */
  disclaimer?: string;
}

/**
 * Check whether a given provider + model combination is on the tested allowlist.
 *
 * Per the spec (§6.4a): the allowlist is **advisory, not enforced**.
 * Non-allowlisted models proceed normally; only a disclaimer is surfaced.
 */
export function checkAllowlist(provider: string, model: string, config: Config): AllowlistResult {
  const list =
    provider === 'lmstudio' ? config.allowlist.lmstudio : config.allowlist.openrouter;

  const allowed = list.includes(model);

  if (!allowed) {
    return {
      allowed: false,
      disclaimer:
        `⚠️  Model '${model}' (${provider}) is not on the tested allowlist.\n` +
        `   Tool-calling and instruction-following may not work as intended with this harness.\n` +
        `   Session will proceed — this warning is shown once per session, not on every turn.`,
    };
  }

  return { allowed: true };
}
