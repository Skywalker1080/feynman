export type TranscriptItem =
  | { kind: 'user'; id: number; text: string }
  | { kind: 'assistant'; id: number; text: string; streaming: boolean }
  | { kind: 'tool'; id: number; toolName: string; argsSummary?: string; resultPreview?: string }
  | { kind: 'system'; id: number; text: string }
  | { kind: 'error'; id: number; text: string };

export type TranscriptAction =
  | { type: 'user'; text: string }
  | { type: 'assistant-start' }
  | { type: 'assistant-delta'; delta: string }
  | { type: 'assistant-end' }
  | { type: 'tool-call'; toolName: string; argsSummary?: string }
  | { type: 'tool-result'; resultPreview: string }
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

function lastToolIndex(items: TranscriptItem[]): number {
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
        return [...items, { kind: 'assistant', id: nextId(items), text: action.delta, streaming: true }];
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
        { kind: 'tool', id: nextId(items), toolName: action.toolName, argsSummary: action.argsSummary },
      ];

    case 'tool-result': {
      const idx = lastToolIndex(items);
      if (idx === -1) return items;
      const copy = [...items];
      const it = copy[idx] as Extract<TranscriptItem, { kind: 'tool' }>;
      copy[idx] = { ...it, resultPreview: action.resultPreview };
      return copy;
    }

    case 'system':
      return [...items, { kind: 'system', id: nextId(items), text: action.text }];

    case 'error':
      return [...items, { kind: 'error', id: nextId(items), text: action.text }];

    case 'reset':
      return [];
  }
}
