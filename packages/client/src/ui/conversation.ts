export type ToolStatus = 'running' | 'done' | 'error';

export type TranscriptItem =
  | { kind: 'user'; id: number; text: string }
  | { kind: 'assistant'; id: number; text: string; streaming: boolean }
  | {
      kind: 'tool';
      id: number;
      /** Correlation id shared between the matching tool-call / tool-result SSE events */
      toolCallId: string;
      toolName: string;
      /** Raw args as received from the server (for diff rendering) */
      args: unknown;
      /** One-line args summary shown when the card is collapsed */
      argsSummary: string;
      status: ToolStatus;
      /** Client timestamp (ms) when the tool-call event arrived */
      startedAt: number;
      /** Wall-clock duration once the result arrives */
      elapsedMs?: number;
      /** Full result text (shown when expanded) */
      result?: string;
      /** One-line truncated result shown while collapsed */
      resultPreview?: string;
      /** Error message when the tool (or its turn) failed */
      error?: string;
      expanded: boolean;
    }
  | { kind: 'system'; id: number; text: string }
  | { kind: 'error'; id: number; text: string };

export type TranscriptAction =
  | { type: 'user'; text: string }
  | { type: 'assistant-start' }
  | { type: 'assistant-delta'; delta: string }
  | { type: 'assistant-end' }
  | {
      type: 'tool-call';
      toolCallId: string;
      toolName: string;
      args: unknown;
      argsSummary: string;
      startedAt: number;
    }
  | { type: 'tool-result'; toolCallId: string; result: string }
  | { type: 'toggle-tool'; toolCallId: string }
  | { type: 'fail-running-tools'; message: string }
  | { type: 'system'; text: string }
  | { type: 'error'; text: string }
  | { type: 'reset' };

export function createTranscript(): TranscriptItem[] {
  return [];
}

function lastAssistantIndex(items: TranscriptItem[]): number {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i]?.kind === 'assistant') return i;
  }
  return -1;
}

/** Index of the most recent tool item matching `toolCallId` (or the last tool overall). */
function findToolIndex(items: TranscriptItem[], toolCallId: string): number {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item?.kind === 'tool' && item.toolCallId === toolCallId) return i;
  }
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i]?.kind === 'tool') return i;
  }
  return -1;
}

function nextId(items: TranscriptItem[]): number {
  let max = 0;
  for (const it of items) if (it.id > max) max = it.id;
  return max + 1;
}

export function transcriptReducer(
  items: TranscriptItem[],
  action: TranscriptAction,
): TranscriptItem[] {
  switch (action.type) {
    case 'user':
      return [...items, { kind: 'user', id: nextId(items), text: action.text }];

    case 'assistant-start':
      return [...items, { kind: 'assistant', id: nextId(items), text: '', streaming: true }];

    case 'assistant-delta': {
      const idx = lastAssistantIndex(items);
      if (idx === -1) {
        return [
          ...items,
          { kind: 'assistant', id: nextId(items), text: action.delta, streaming: true },
        ];
      }
      const copy = [...items];
      const it = copy[idx] as Extract<TranscriptItem, { kind: 'assistant' }>;
      copy[idx] = { ...it, text: it.text + action.delta };
      return copy;
    }

    case 'assistant-end': {
      const idx = lastAssistantIndex(items);
      if (idx === -1) return items;
      const copy = [...items];
      const it = copy[idx] as Extract<TranscriptItem, { kind: 'assistant' }>;
      copy[idx] = { ...it, streaming: false };
      return copy;
    }

    case 'tool-call':
      return [
        ...items,
        {
          kind: 'tool',
          id: nextId(items),
          toolCallId: action.toolCallId,
          toolName: action.toolName,
          args: action.args,
          argsSummary: action.argsSummary,
          status: 'running',
          startedAt: action.startedAt,
          expanded: false,
        },
      ];

    case 'tool-result': {
      const idx = findToolIndex(items, action.toolCallId);
      if (idx === -1) return items;
      const copy = [...items];
      const it = copy[idx] as Extract<TranscriptItem, { kind: 'tool' }>;
      const oneLine = action.result.replace(/\n/g, ' ');
      copy[idx] = {
        ...it,
        status: 'done',
        result: action.result,
        resultPreview: oneLine.length > 120 ? `${oneLine.slice(0, 117)}…` : oneLine,
        elapsedMs: Math.max(0, Date.now() - it.startedAt),
      };
      return copy;
    }

    case 'toggle-tool': {
      const idx = findToolIndex(items, action.toolCallId);
      if (idx === -1) return items;
      const copy = [...items];
      const it = copy[idx] as Extract<TranscriptItem, { kind: 'tool' }>;
      copy[idx] = { ...it, expanded: !it.expanded };
      return copy;
    }

    case 'fail-running-tools': {
      let changed = false;
      const copy = items.map((item) => {
        if (item.kind !== 'tool' || item.status !== 'running') return item;
        changed = true;
        return { ...item, status: 'error' as const, error: action.message };
      });
      return changed ? copy : items;
    }

    case 'system':
      return [...items, { kind: 'system', id: nextId(items), text: action.text }];

    case 'error':
      return [...items, { kind: 'error', id: nextId(items), text: action.text }];

    case 'reset':
      return [];
  }
}
