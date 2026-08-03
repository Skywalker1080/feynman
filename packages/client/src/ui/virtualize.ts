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
    case 'system':
    case 'error':
    case 'assistant':
      return margin + estimateTextRows(item.text, hints.columns);
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
  /** Number of items scrolled out above the window. */
  overflow: number;
}

/** Window the newest items that fit in `availableRows`; always keeps the newest. */
export function computeSlice(heights: number[], availableRows: number): VirtualSlice {
  const max = Math.max(1, availableRows);
  let used = 0;
  let start = heights.length;
  for (let i = heights.length - 1; i >= 0; i--) {
    const h = heights[i]!;
    if (used + h > max) break;
    used += h;
    start = i;
  }
  if (start === heights.length) {
    // Nothing fits; keep the newest item anyway.
    start = Math.max(0, heights.length - 1);
  }
  return { start, overflow: start };
}
