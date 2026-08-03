import type { Session } from '@feynman/types';

function isBoundary(ch: string | undefined): boolean {
  return ch === undefined || ch === ' ' || ch === '/' || ch === '_' || ch === '-' || ch === '.' || ch === ':';
}

/**
 * Subsequence fuzzy-match score for `query` inside `text`. Returns 0 when the
 * query characters do not appear in order. Higher score = better match:
 * consecutive hits, matches at the start, and matches after word boundaries
 * all earn bonuses.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (q === '') return 0;

  let score = 0;
  let streak = 0;
  let last = -2;
  let from = 0;
  for (const ch of q) {
    const at = t.indexOf(ch, from);
    if (at === -1) return 0;
    if (at === 0) score += 6;
    else if (isBoundary(t[at - 1])) score += 3;
    streak = at === last + 1 ? streak + 1 : 0;
    score += 1 + streak;
    last = at;
    from = at + 1;
  }
  return score;
}

/** Concatenated fields searched when filtering sessions. */
export function sessionSearchText(s: Session): string {
  return [s.title, s.preview, s.id, s.cwd, s.model].filter(Boolean).join(' ');
}

/**
 * Filter sessions by fuzzy match over title/preview, id, cwd and model.
 * Best matches first; equal scores keep the input (updated_at desc) order.
 */
export function filterSessions(sessions: Session[], query: string): Session[] {
  const q = query.trim();
  if (q === '') return sessions;
  return sessions
    .map((s) => ({ s, score: fuzzyScore(q, sessionSearchText(s)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
}
