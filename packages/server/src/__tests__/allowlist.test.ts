import { describe, it, expect } from 'vitest';
import { checkAllowlist } from '../allowlist';
import type { Config } from '@feynman/types';

const mockConfig = {
  allowlist: {
    lmstudio: ['qwen3-30b-a3b', 'devstral-small-2505'],
    openrouter: ['anthropic/claude-sonnet-4-5', 'openai/gpt-4o'],
  },
} as Config;

describe('checkAllowlist', () => {
  it('returns allowed:true for a listed lmstudio model', () => {
    const result = checkAllowlist('lmstudio', 'qwen3-30b-a3b', mockConfig);
    expect(result.allowed).toBe(true);
    expect(result.disclaimer).toBeUndefined();
  });

  it('returns allowed:true for a listed openrouter model', () => {
    const result = checkAllowlist('openrouter', 'anthropic/claude-sonnet-4-5', mockConfig);
    expect(result.allowed).toBe(true);
  });

  it('returns allowed:false with disclaimer for an unlisted model', () => {
    const result = checkAllowlist('lmstudio', 'unknown-model-xyz', mockConfig);
    expect(result.allowed).toBe(false);
    expect(result.disclaimer).toBeDefined();
    expect(result.disclaimer).toContain('unknown-model-xyz');
  });

  it('disclaimer mentions the provider', () => {
    const result = checkAllowlist('openrouter', 'some/random-model', mockConfig);
    expect(result.disclaimer).toContain('openrouter');
  });
});
