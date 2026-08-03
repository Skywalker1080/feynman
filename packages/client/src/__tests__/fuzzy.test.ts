import { describe, it, expect } from 'vitest';
import type { Session } from '@feynman/types';
import { fuzzyScore, filterSessions } from '../ui/fuzzy';

function session(partial: Partial<Session>): Session {
  return {
    id: 'id',
    created_at: '',
    updated_at: '',
    cwd: '',
    provider: 'openrouter',
    model: 'm',
    ...partial,
  };
}

describe('fuzzyScore', () => {
  it('scores 0 when the query is not a subsequence', () => {
    expect(fuzzyScore('zzz', 'hello world')).toBe(0);
  });

  it('scores 0 for an empty query', () => {
    expect(fuzzyScore('', 'hello')).toBe(0);
  });

  it('matches a subsequence in order', () => {
    expect(fuzzyScore('hlo', 'hello')).toBeGreaterThan(0);
  });

  it('prefers a match at the start of the text', () => {
    expect(fuzzyScore('fix', 'fix bug')).toBeGreaterThan(fuzzyScore('fix', 'apply hotfix'));
  });

  it('prefers consecutive characters over scattered ones', () => {
    const consecutive = fuzzyScore('test', 'test the feature');
    const scattered = fuzzyScore('test', 'the feature is set');
    expect(consecutive).toBeGreaterThan(scattered);
  });

  it('matches case-insensitively', () => {
    expect(fuzzyScore('RES', 'resume')).toBeGreaterThan(0);
  });
});

describe('filterSessions', () => {
  const sessions = [
    session({ id: 'a', title: 'Fix the build', preview: 'npm run build fails', cwd: 'C:\\repo', model: 'x' }),
    session({ id: 'b', title: 'Add login page', preview: 'Design the auth flow', cwd: 'C:\\app', model: 'y' }),
    session({ id: 'c', title: 'Refactor sessions', preview: 'Session list', cwd: 'C:\\feynman', model: 'z' }),
  ];

  it('returns everything for an empty query', () => {
    expect(filterSessions(sessions, '')).toHaveLength(3);
    expect(filterSessions(sessions, '   ')).toHaveLength(3);
  });

  it('matches against the title', () => {
    const hits = filterSessions(sessions, 'login');
    expect(hits.map((s) => s.id)).toEqual(['b']);
  });

  it('matches against the preview', () => {
    const hits = filterSessions(sessions, 'auth flow');
    expect(hits.map((s) => s.id)).toEqual(['b']);
  });

  it('matches against the cwd', () => {
    const hits = filterSessions(sessions, 'feynman');
    expect(hits.map((s) => s.id)).toEqual(['c']);
  });

  it('matches scattered subsequences, not just substrings', () => {
    const hits = filterSessions([session({ id: 'x', preview: 'something out there' })], 'str');
    expect(hits.map((s) => s.id)).toEqual(['x']);
  });

  it('ranks better matches first', () => {
    const stronger = session({ id: 'strong', title: 'Fix the build' });
    const weaker = session({ id: 'weak', title: 'Apply hotfix' });
    const hits = filterSessions([weaker, stronger], 'fix');
    expect(hits[0]?.id).toBe('strong'); // match at start beats mid-word
    expect(hits[1]?.id).toBe('weak');
  });
});
