import { describe, it, expect } from 'vitest';
import { renderToString } from 'ink';
import type { Session } from '@feynman/types';
import { SessionPicker, formatRelativeTime } from '../ui/SessionPicker';
import { resolveTheme } from '../ui/theme';

const theme = resolveTheme({ noColor: true });

const noop = () => undefined;

function session(partial: Partial<Session>): Session {
  return {
    id: 'id',
    created_at: '',
    updated_at: '',
    cwd: '/repo',
    provider: 'openrouter',
    model: 'x/y',
    ...partial,
  };
}

describe('SessionPicker', () => {
  const sessions = [
    session({
      id: 'a1',
      title: 'Fix the build',
      preview: 'npm run build fails',
      cwd: 'C:\\repo',
      updated_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    }),
    session({
      id: 'b2',
      title: 'Add login page',
      preview: 'Design the auth flow',
      cwd: 'C:\\app',
      updated_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    }),
  ];

  it('shows the resume prompt line', () => {
    const out = renderToString(
      <SessionPicker sessions={sessions} onSelect={noop} onClose={noop} theme={theme} />,
    );
    expect(out).toContain('resume:');
  });

  it('renders each session row with preview, cwd, date and model', () => {
    const out = renderToString(
      <SessionPicker sessions={sessions} onSelect={noop} onClose={noop} theme={theme} />,
    );
    expect(out).toContain('npm run build fails');
    expect(out).toContain('Design the auth flow');
    expect(out).toContain('C:\\repo');
    expect(out).toContain('C:\\app');
    expect(out).toContain('5m ago');
    expect(out).toContain('3h ago');
    expect(out).toContain('x/y');
  });

  it('highlights the first row as selected', () => {
    const out = renderToString(
      <SessionPicker sessions={sessions} onSelect={noop} onClose={noop} theme={theme} />,
    );
    expect(out).toContain('› npm run build fails');
  });

  it('falls back to the title when preview is missing', () => {
    const out = renderToString(
      <SessionPicker
        sessions={[session({ id: 't', title: 'Untitled-ish' })]}
        onSelect={noop}
        onClose={noop}
        theme={theme}
      />,
    );
    expect(out).toContain('Untitled-ish');
  });

  it('shows a no-matches line when the list is empty', () => {
    const out = renderToString(
      <SessionPicker sessions={[]} onSelect={noop} onClose={noop} theme={theme} />,
    );
    expect(out).toContain('no sessions match');
  });

  it('caps rows and reports the overflow count', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      session({ id: `s${i}`, title: `session ${i}` }),
    );
    const out = renderToString(
      <SessionPicker sessions={many} onSelect={noop} onClose={noop} theme={theme} />,
    );
    expect(out).toContain('5 more');
    expect(out).not.toContain('session 14');
  });
});

describe('formatRelativeTime', () => {
  it('formats seconds, minutes, hours and days', () => {
    const now = Date.now();
    expect(formatRelativeTime(new Date(now - 10_000).toISOString())).toBe('just now');
    expect(formatRelativeTime(new Date(now - 5 * 60_000).toISOString())).toBe('5m ago');
    expect(formatRelativeTime(new Date(now - 3 * 60 * 60_000).toISOString())).toBe('3h ago');
    expect(formatRelativeTime(new Date(now - 2 * 24 * 60 * 60_000).toISOString())).toBe('2d ago');
  });

  it('returns empty for an invalid date', () => {
    expect(formatRelativeTime('not-a-date')).toBe('');
  });
});
