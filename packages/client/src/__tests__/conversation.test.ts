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
    items = transcriptReducer(items, {
      type: 'tool-call',
      toolCallId: 'tc-1',
      toolName: 'read_file',
      args: { path: 'a.ts' },
      argsSummary: 'a.ts',
      startedAt: 1000,
    });
    items = transcriptReducer(items, { type: 'tool-result', toolCallId: 'tc-1', result: 'line 1' });
    items = transcriptReducer(items, { type: 'assistant-delta', delta: 'done' });
    items = transcriptReducer(items, { type: 'assistant-end' });

    expect(items.map((i) => i.kind)).toEqual(['user', 'assistant', 'tool']);
    const tool = items[2] as Extract<(typeof items)[number], { kind: 'tool' }>;
    expect(tool.toolName).toBe('read_file');
    expect(tool.status).toBe('done');
    expect(tool.result).toBe('line 1');
    expect(tool.resultPreview).toBe('line 1');
    // the single assistant item accumulates text across tool boundaries
    const assistant = items[1] as Extract<(typeof items)[number], { kind: 'assistant' }>;
    expect(assistant.text).toBe('done');
  });

  it('correlates parallel tool calls by their own ids', () => {
    let items = createTranscript();
    items = transcriptReducer(items, {
      type: 'tool-call',
      toolCallId: 'tc-a',
      toolName: 'read_file',
      args: { path: 'a.ts' },
      argsSummary: 'a.ts',
      startedAt: 1000,
    });
    items = transcriptReducer(items, {
      type: 'tool-call',
      toolCallId: 'tc-b',
      toolName: 'search',
      args: { pattern: 'foo' },
      argsSummary: '~ foo',
      startedAt: 1001,
    });
    // Results arrive out of order — tc-b finishes first.
    items = transcriptReducer(items, {
      type: 'tool-result',
      toolCallId: 'tc-b',
      result: 'hit in b.ts',
    });
    items = transcriptReducer(items, {
      type: 'tool-result',
      toolCallId: 'tc-a',
      result: 'contents of a',
    });

    const tools = items.filter((i) => i.kind === 'tool') as Extract<
      (typeof items)[number],
      { kind: 'tool' }
    >[];
    expect(tools).toHaveLength(2);
    expect(tools[0]).toMatchObject({ toolCallId: 'tc-a', status: 'done', result: 'contents of a' });
    expect(tools[1]).toMatchObject({ toolCallId: 'tc-b', status: 'done', result: 'hit in b.ts' });
  });

  it('tracks running status until a result arrives', () => {
    let items = createTranscript();
    items = transcriptReducer(items, {
      type: 'tool-call',
      toolCallId: 'tc-1',
      toolName: 'run_terminal',
      args: { command: 'npm test' },
      argsSummary: 'npm test',
      startedAt: 1000,
    });
    const tool = items[0] as Extract<(typeof items)[number], { kind: 'tool' }>;
    expect(tool.status).toBe('running');
    expect(tool.expanded).toBe(false);
  });

  it('toggles a tool card expanded state by id', () => {
    let items = createTranscript();
    items = transcriptReducer(items, {
      type: 'tool-call',
      toolCallId: 'tc-1',
      toolName: 'read_file',
      args: {},
      argsSummary: '',
      startedAt: 1000,
    });
    items = transcriptReducer(items, { type: 'toggle-tool', toolCallId: 'tc-1' });
    expect((items[0] as Extract<(typeof items)[number], { kind: 'tool' }>).expanded).toBe(true);
    items = transcriptReducer(items, { type: 'toggle-tool', toolCallId: 'tc-1' });
    expect((items[0] as Extract<(typeof items)[number], { kind: 'tool' }>).expanded).toBe(false);
  });

  it('marks running tools as failed on a turn error', () => {
    let items = createTranscript();
    items = transcriptReducer(items, {
      type: 'tool-call',
      toolCallId: 'tc-1',
      toolName: 'edit',
      args: {},
      argsSummary: '',
      startedAt: 1000,
    });
    items = transcriptReducer(items, { type: 'fail-running-tools', message: 'boom' });
    const tool = items[0] as Extract<(typeof items)[number], { kind: 'tool' }>;
    expect(tool.status).toBe('error');
    expect(tool.error).toBe('boom');
  });

  it('does not mark completed tools as failed on a turn error', () => {
    let items = createTranscript();
    items = transcriptReducer(items, {
      type: 'tool-call',
      toolCallId: 'tc-1',
      toolName: 'read_file',
      args: {},
      argsSummary: '',
      startedAt: 1000,
    });
    items = transcriptReducer(items, { type: 'tool-result', toolCallId: 'tc-1', result: 'ok' });
    items = transcriptReducer(items, { type: 'fail-running-tools', message: 'boom' });
    const tool = items[0] as Extract<(typeof items)[number], { kind: 'tool' }>;
    expect(tool.status).toBe('done');
  });

  it('marks running tools as cancelled, leaving completed ones done', () => {
    let items = createTranscript();
    items = transcriptReducer(items, {
      type: 'tool-call',
      toolCallId: 'tc-1',
      toolName: 'run_terminal',
      args: { command: 'sleep 100' },
      argsSummary: 'sleep 100',
      startedAt: 1000,
    });
    items = transcriptReducer(items, {
      type: 'tool-call',
      toolCallId: 'tc-2',
      toolName: 'read_file',
      args: {},
      argsSummary: '',
      startedAt: 1001,
    });
    items = transcriptReducer(items, { type: 'tool-result', toolCallId: 'tc-2', result: 'ok' });
    items = transcriptReducer(items, { type: 'cancel-running-tools' });
    const tools = items.filter((i) => i.kind === 'tool') as Extract<
      (typeof items)[number],
      { kind: 'tool' }
    >[];
    expect(tools[0]).toMatchObject({ toolCallId: 'tc-1', status: 'cancelled' });
    expect(tools[1]).toMatchObject({ toolCallId: 'tc-2', status: 'done' });
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
    items = transcriptReducer(items, {
      type: 'tool-call',
      toolCallId: 'tc-1',
      toolName: 'run_terminal',
      args: {},
      argsSummary: '',
      startedAt: 1000,
    });
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
