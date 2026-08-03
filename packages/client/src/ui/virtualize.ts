import type { TranscriptItem } from './conversation';

export interface VirtualizeHints {
  columns: number;
  availableRows: number;
  /** toolCallId of the focused tool card (adds its border to the estimate). */
  focusedToolCallId: string | null;
}

/** Rough rows needed to render text wrapped at `columns` cells. */
export function estimateTextRows(text: string, columns: number): number {
  const col = Math.max(1, columns);
  let rows = 0;
  for (const line of text.split('\n')) {
    rows += Math.max(1, Math.ceil(line.length / col));
  }
  return Math.max(1, rows);
}

/** Estimated rendered height (in rows) of a transcript item. */
export function estimateItemHeight(item: TranscriptItem, hints: VirtualizeHints): number {
  const margin = 1; // every row has marginTop={1}
  switch (item.kind) {
    case 'user':
    case 'error':
    case 'assistant':
      // +1 for the timestamp+speaker header line rendered above each message
      return margin + 1 + estimateTextRows(item.text, hints.columns);
    case 'system':
      return margin + (item.banner ? 0 : 1) + estimateTextRows(item.text, hints.columns);
    case 'tool': {
      const focused = item.toolCallId === hints.focusedToolCallId;
      const border = focused ? 2 : 0;
      let body: number;
      if (item.expanded) {
        if (item.error) body = estimateTextRows(item.error, hints.columns);
        else if (item.result) body = estimateTextRows(item.result, hints.columns);
        else body = 1;
      } else {
        body = 1;
      }
      return margin + border + 1 + body; // +1 header line
    }
  }
}

export interface VirtualSlice {
  /** Index into the item array of the first (oldest) rendered item. */
  start: number;
  /** Exclusive end index — items beyond this are scrolled off the bottom. */
  end: number;
  /** Number of items hidden above the window (older). */
  overflow: number;
}

/**
 * Compute the window of items that fits in `availableRows`.
 *
 * `scrollOffset` shifts the window upward: 0 = anchored to the newest item,
 * positive = scrolled back into history by that many items.
 */
export function computeSlice(
  heights: number[],
  availableRows: number,
  scrollOffset = 0,
): VirtualSlice {
  const max = Math.max(1, availableRows);
  // Clamp the exclusive end so we never go past the array bounds.
  const end = Math.min(heights.length, Math.max(1, heights.length - scrollOffset));

  let used = 0;
  let start = end;
  for (let i = end - 1; i >= 0; i--) {
    const h = heights[i]!;
    if (used + h > max) break;
    used += h;
    start = i;
  }
  if (start === end) {
    // Nothing fits — keep at least the single item just before end.
    start = Math.max(0, end - 1);
  }
  return { start, end, overflow: start };
}
