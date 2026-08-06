export type ToolStatus = 'running' | 'done' | 'error' | 'cancelled';

export type TranscriptItem =
  | { kind: 'user'; id: number; text: string; createdAt: number }
  | { kind: 'assistant'; id: number; text: string; streaming: boolean; createdAt: number }
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
  | { kind: 'system'; id: number; text: string; createdAt: number; banner?: boolean }
  | { kind: 'error'; id: number; text: string; createdAt: number };

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
  | { type: 'cancel-running-tools' }
  | { type: 'system'; text: string; banner?: boolean }
  | { type: 'error'; text: string }
  | { type: 'reset' };

export function createTranscript(): TranscriptItem[] {
  return [];
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
      return [...items, { kind: 'user', id: nextId(items), text: action.text, createdAt: Date.now() }];

    case 'assistant-start':
      // The assistant bubble is created lazily on the first text-delta so it
      // lands AFTER any tool cards already in the transcript. Otherwise the
      // reply would render above the tools and the tool cards would sit pinned
      // above the input, starving the model's message of space.
      return items;

    case 'assistant-delta': {
      const last = items[items.length - 1];
      // Append to the current bubble only when it is the newest item. If the
      // model ran tools in between, start a fresh bubble below the tools so the
      // reply scrolls up like a normal text message.
      if (last && last.kind === 'assistant' && last.streaming) {
        const copy = [...items];
        const it = copy[copy.length - 1] as Extract<TranscriptItem, { kind: 'assistant' }>;
        copy[copy.length - 1] = { ...it, text: it.text + action.delta };
        return copy;
      }
      return [
        ...items,
        { kind: 'assistant', id: nextId(items), text: action.delta, streaming: true, createdAt: Date.now() },
      ];
    }

    case 'assistant-end': {
      let changed = false;
      const copy = items.map((item) => {
        if (item.kind === 'assistant' && item.streaming) {
          changed = true;
          return { ...item, streaming: false };
        }
        return item;
      });
      return changed ? copy : items;
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

    case 'cancel-running-tools': {
      let changed = false;
      const copy = items.map((item) => {
        if (item.kind !== 'tool' || item.status !== 'running') return item;
        changed = true;
        return { ...item, status: 'cancelled' as const };
      });
      return changed ? copy : items;
    }

    case 'system':
      return [...items, { kind: 'system', id: nextId(items), text: action.text, createdAt: Date.now(), banner: action.banner }];

    case 'error':
      return [...items, { kind: 'error', id: nextId(items), text: action.text, createdAt: Date.now() }];

    case 'reset':
      return [];
  }
}
