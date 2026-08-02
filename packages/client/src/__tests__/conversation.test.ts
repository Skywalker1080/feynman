import { describe, it, expect } from 'vitest';
import { createTranscript, transcriptReducer } from '../ui/conversation';

describe('transcriptReducer', () => {
  it('accumulates a full user -> assistant -> done flow', () => {
    let items = createTranscript();
    items = transcriptReducer(items, { type: 'user', text: 'hello' });
    items = transcriptReducer(items, { type: 'assistant-start' });
    items = transcriptReducer(items, { type: 'assistant-delta', delta: 'Hi ' });
    items = transcriptReducer(items, { type: 'assistant-delta', delta: 'there' });
    items = transcriptReducer(items, { type: 'assistant-end' });

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ kind: 'user', text: 'hello' });
    expect(items[1]).toMatchObject({ kind: 'assistant', text: 'Hi there', streaming: false });
  });

  it('interleaves tool calls into the assistant turn', () => {
    let items = createTranscript();
    items = transcriptReducer(items, { type: 'user', text: 'go' });
    items = transcriptReducer(items, { type: 'assistant-start' });
    items = transcriptReducer(items, { type: 'tool-call', toolName: 'read_file', argsSummary: '{path:"a.ts"}' });
    items = transcriptReducer(items, { type: 'tool-result', resultPreview: 'line 1' });
    items = transcriptReducer(items, { type: 'assistant-delta', delta: 'done' });
    items = transcriptReducer(items, { type: 'assistant-end' });

    expect(items.map((i) => i.kind)).toEqual(['user', 'assistant', 'tool']);
    const tool = items[2] as Extract<typeof items[number], { kind: 'tool' }>;
    expect(tool.toolName).toBe('read_file');
    expect(tool.resultPreview).toBe('line 1');
    // the single assistant item accumulates text across tool boundaries
    const assistant = items[1] as Extract<typeof items[number], { kind: 'assistant' }>;
    expect(assistant.text).toBe('done');
  });

  it('ignores assistant-end without an assistant item', () => {
    let items = createTranscript();
    items = transcriptReducer(items, { type: 'assistant-end' });
    expect(items).toHaveLength(0);
  });

  it('records system, error and tool-only turns', () => {
    let items = createTranscript();
    items = transcriptReducer(items, { type: 'system', text: 'disclaimer' });
    items = transcriptReducer(items, { type: 'error', text: 'boom' });
    items = transcriptReducer(items, { type: 'tool-call', toolName: 'run_terminal' });
    expect(items.map((i) => i.kind)).toEqual(['system', 'error', 'tool']);
  });

  it('reset clears the transcript', () => {
    let items = createTranscript();
    items = transcriptReducer(items, { type: 'user', text: 'x' });
    items = transcriptReducer(items, { type: 'reset' });
    expect(items).toHaveLength(0);
  });

  it('re-uses ids correctly after reset', () => {
    let items = createTranscript();
    items = transcriptReducer(items, { type: 'user', text: 'one' });
    const first = items[0]?.id ?? -1;
    items = transcriptReducer(items, { type: 'reset' });
    items = transcriptReducer(items, { type: 'user', text: 'two' });
    expect(items[0]?.id).toBeGreaterThanOrEqual(first);
  });
});
