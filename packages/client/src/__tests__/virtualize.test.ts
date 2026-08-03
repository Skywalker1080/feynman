import { describe, it, expect } from 'vitest';
import { estimateItemHeight, estimateTextRows, computeSlice } from '../ui/virtualize';
import type { TranscriptItem } from '../ui/conversation';

const hints = { columns: 80, availableRows: 20, focusedToolCallId: null };

function item(partial: TranscriptItem): TranscriptItem {
  return partial;
}

describe('estimateTextRows', () => {
  it('wraps long text to the column width', () => {
    expect(estimateTextRows('abcdef', 5)).toBe(2);
    expect(estimateTextRows('ab', 5)).toBe(1);
  });

  it('counts multiple physical lines', () => {
    expect(estimateTextRows('a\nb\nc', 80)).toBe(3);
  });
});

describe('estimateItemHeight', () => {
  it('includes the row margin for text items', () => {
    expect(estimateItemHeight(item({ kind: 'assistant', id: 1, text: 'hi', streaming: false }), hints)).toBe(2);
    expect(estimateItemHeight(item({ kind: 'user', id: 1, text: 'hi' }), hints)).toBe(2);
    expect(estimateItemHeight(item({ kind: 'system', id: 1, text: 'hi' }), hints)).toBe(2);
    expect(estimateItemHeight(item({ kind: 'error', id: 1, text: 'hi' }), hints)).toBe(2);
  });

  it('estimates a collapsed tool card', () => {
    expect(
      estimateItemHeight(
        item({
          kind: 'tool',
          id: 1,
          toolCallId: 't1',
          toolName: 'read_file',
          args: {},
          argsSummary: 'a.ts',
          status: 'done',
          startedAt: 0,
          elapsedMs: 1,
          result: 'x',
          resultPreview: 'x',
          expanded: false,
        }),
        hints,
      ),
    ).toBe(3);
  });

  it('adds the focused border', () => {
    const card = item({
      kind: 'tool',
      id: 1,
      toolCallId: 't1',
      toolName: 'read_file',
      args: {},
      argsSummary: 'a.ts',
      status: 'running',
      startedAt: 0,
      expanded: false,
    }) as TranscriptItem;
    expect(estimateItemHeight(card, { ...hints, focusedToolCallId: 't1' })).toBe(5);
  });

  it('estimates an expanded card body from the result', () => {
    const card = item({
      kind: 'tool',
      id: 1,
      toolCallId: 't1',
      toolName: 'read_file',
      args: {},
      argsSummary: 'a.ts',
      status: 'done',
      startedAt: 0,
      elapsedMs: 1,
      result: 'a\nb',
      expanded: true,
    }) as TranscriptItem;
    expect(estimateItemHeight(card, hints)).toBe(4);
  });
});

describe('computeSlice', () => {
  it('keeps all items when they fit', () => {
    expect(computeSlice([1, 1, 1], 5)).toEqual({ start: 0, overflow: 0 });
  });

  it('windows the newest items when they overflow', () => {
    expect(computeSlice([1, 1, 1, 1], 3)).toEqual({ start: 1, overflow: 1 });
  });

  it('always keeps the newest item even when nothing fits', () => {
    expect(computeSlice([5], 3)).toEqual({ start: 0, overflow: 0 });
  });

  it('returns an empty window for no items', () => {
    expect(computeSlice([], 10)).toEqual({ start: 0, overflow: 0 });
  });
});
