export interface History {
  /** Newest-first list of past inputs. */
  entries: string[];
  /** Position while walking; -1 means "fresh input" (beyond the newest entry). */
  index: number;
}

export const HISTORY_LIMIT = 200;

export function createHistory(): History {
  return { entries: [], index: -1 };
}

/** Record an input, deduping adjacent-similar entries; resets navigation. */
export function pushHistory(h: History, entry: string): History {
  const clean = entry.trim();
  if (!clean) return h;
  const entries = [clean, ...h.entries.filter((e) => e !== clean)].slice(0, HISTORY_LIMIT);
  return { entries, index: -1 };
}

/** Move toward older entries. Returns the value to load (empty when no history). */
export function historyUp(h: History): { index: number; value: string } {
  if (h.entries.length === 0) return { index: h.index, value: '' };
  const index = Math.min(h.index + 1, h.entries.length - 1);
  return { index, value: h.entries[index] ?? '' };
}

/** Move toward newer entries; returns '' when back to fresh input. */
export function historyDown(h: History): { index: number; value: string } {
  if (h.index <= -1) return { index: -1, value: '' };
  const index = h.index - 1;
  return { index, value: index === -1 ? '' : h.entries[index] ?? '' };
}

/** Entries containing the query (newest first). Empty query returns []. */
export function historySearch(h: History, query: string): string[] {
  const q = query.toLowerCase();
  if (!q) return [];
  return h.entries.filter((e) => e.toLowerCase().includes(q));
}
