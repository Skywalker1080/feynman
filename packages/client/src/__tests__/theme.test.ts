import { describe, it, expect } from 'vitest';
import { resolveTheme, noColorEnabled } from '../ui/theme';

describe('resolveTheme', () => {
  it('returns named colors by default', () => {
    const t = resolveTheme({ noColor: false });
    expect(t.accent).toBe('cyan');
    expect(t.error).toBe('red');
    expect(t.tool).toBe('cyan');
  });

  it('disables all colors when noColor is set', () => {
    const t = resolveTheme({ noColor: true });
    expect(t.accent).toBeUndefined();
    expect(t.error).toBeUndefined();
    expect(t.assistant).toBeUndefined();
  });

  it('noColorEnabled respects the NO_COLOR env convention', () => {
    const before = process.env.NO_COLOR;
    try {
      process.env.NO_COLOR = '';
      expect(noColorEnabled()).toBe(false);
      process.env.NO_COLOR = '1';
      expect(noColorEnabled()).toBe(true);
    } finally {
      if (before === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = before;
    }
  });
});
