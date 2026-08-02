import { describe, it, expect } from 'vitest';
import { shouldUseTUI, requestedPlain } from '../ui/tty';

describe('shouldUseTUI', () => {
  it('uses the TUI when both streams are TTYs', () => {
    expect(shouldUseTUI({ stdoutIsTTY: true, stdinIsTTY: true })).toBe(true);
  });

  it('falls back to plain when stdout is not a TTY', () => {
    expect(shouldUseTUI({ stdoutIsTTY: false, stdinIsTTY: true })).toBe(false);
  });

  it('falls back to plain when stdin is not a TTY', () => {
    expect(shouldUseTUI({ stdoutIsTTY: true, stdinIsTTY: false })).toBe(false);
  });

  it('forces plain when --plain is set', () => {
    expect(shouldUseTUI({ plain: true, stdoutIsTTY: true, stdinIsTTY: true })).toBe(false);
  });
});

describe('requestedPlain', () => {
  it('detects --plain and -p', () => {
    expect(requestedPlain(['node', 'feynman', '--plain'])).toBe(true);
    expect(requestedPlain(['node', 'feynman', '-p'])).toBe(true);
    expect(requestedPlain(['node', 'feynman'])).toBe(false);
  });
});
