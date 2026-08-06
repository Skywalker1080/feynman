import { describe, it, expect } from 'vitest';
import { renderToString } from 'ink';
import type { Session } from '@feynman/types';
import { Header } from '../ui/Header';
import { StatusBar } from '../ui/StatusBar';
import { Transcript } from '../ui/Transcript';
import { ToolCard } from '../ui/ToolCard';
import type { TranscriptItem } from '../ui/conversation';
import { resolveTheme } from '../ui/theme';

const theme = resolveTheme({ noColor: true });

const session = {
  id: 'abc123',
  created_at: '',
  updated_at: '',
  cwd: '/repo',
  provider: 'openrouter',
  model: 'x/y',
} as Session;

describe('presentational components render', () => {
  it('Header shows app name, cwd, provider and model', () => {
    const out = renderToString(<Header cwd="/repo" session={session} theme={theme} />);
    expect(out).toContain('Feynman');
    expect(out).toContain('/repo');
    expect(out).toContain('openrouter');
    expect(out).toContain('x/y');
  });

  it('StatusBar shows session id and ready state', () => {
    const out = renderToString(<StatusBar session={session} busy={false} theme={theme} />);
    expect(out).toContain('abc123');
    expect(out).toContain('ready');
    expect(out).toContain('Ctrl+C exit');
  });

  it('StatusBar shows a working state when busy', () => {
    const out = renderToString(<StatusBar session={session} busy theme={theme} />);
    expect(out).toContain('working');
  });

  it('StatusBar shows tool-card hint when navigating', () => {
    const out = renderToString(
      <StatusBar session={session} busy={false} navActive theme={theme} />,
    );
    expect(out).toContain('tool cards');
  });

  it('StatusBar shows live step and cancel hint while busy', () => {
    const out = renderToString(
      <StatusBar
        session={session}
        busy
        step={3}
        maxSteps={25}
        startedAt={Date.now()}
        theme={theme}
      />,
    );
    expect(out).toContain('step 3/25');
    expect(out).toContain('Esc cancel');
    expect(out).toContain('Ctrl+C cancel');
    expect(out).not.toContain('ready');
  });

  it('StatusBar shows settled usage after a turn', () => {
    const out = renderToString(
      <StatusBar
        session={session}
        busy={false}
        usage={{
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          cost: 0.0042,
          model: 'x/y',
          elapsedMs: 3200,
        }}
        theme={theme}
      />,
    );
    expect(out).toContain('150 tok');
    expect(out).toContain('$0.0042');
    expect(out).toContain('3.2s');
    expect(out).toContain('ready');
  });

  it('Transcript renders user, assistant, tool and system rows', () => {
    const items: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'hello' },
      { kind: 'assistant', id: 2, text: 'hi', streaming: false },
      {
        kind: 'tool',
        id: 3,
        toolCallId: 'tc-1',
        toolName: 'read_file',
        args: { path: 'a.ts' },
        argsSummary: 'Read a.ts',
        status: 'done',
        startedAt: 1000,
        elapsedMs: 5,
        result: 'line 1',
        resultPreview: 'line 1',
        expanded: false,
      },
      { kind: 'system', id: 4, text: 'note' },
      { kind: 'error', id: 5, text: 'boom' },
    ];
    const out = renderToString(
      <Transcript items={items} theme={theme} navActive={false} selectedToolCallId={null} />,
    );
    expect(out).toContain('hello');
    expect(out).toContain('hi');
    expect(out).toContain('Read a.ts');
    expect(out).toContain('note');
    expect(out).toContain('boom');
  });

  it('Transcript renders nothing when empty', () => {
    const out = renderToString(
      <Transcript items={[]} theme={theme} navActive={false} selectedToolCallId={null} />,
    );
    expect(out).toBe('');
  });

  it('Transcript highlights code fences in assistant text', () => {
    const items: TranscriptItem[] = [
      {
        kind: 'assistant',
        id: 1,
        text: 'Here is some code:\n```js\nconst a = 1;\n```',
        streaming: false,
      },
    ];
    const out = renderToString(
      <Transcript items={items} theme={theme} navActive={false} selectedToolCallId={null} />,
    );
    expect(out).toContain('const a = 1;');
    expect(out).toContain('Here is some code:');
  });

  it('Transcript virtualizes long transcripts with an overflow indicator', () => {
    const items: TranscriptItem[] = Array.from({ length: 10 }, (_, i) => ({
      kind: 'assistant',
      id: i + 1,
      text: `msg ${i + 1}`,
      streaming: false,
    }));
    const out = renderToString(
      <Transcript
        items={items}
        theme={theme}
        navActive={false}
        selectedToolCallId={null}
        columns={80}
        availableRows={6}
      />,
    );
    expect(out).toContain('↑ 7 older');
    expect(out).not.toContain('msg 3');
    expect(out).toContain('msg 8');
    expect(out).toContain('msg 10');
  });
});

describe('ToolCard', () => {
  it('shows a spinner glyph while running', () => {
    const out = renderToString(
      <ToolCard
        toolName="run_terminal"
        args={{}}
        argsSummary="npm test"
        status="running"
        startedAt={Date.now()}
        expanded={false}
        focused={false}
        theme={theme}
      />,
    );
    expect(out).toContain('npm test');
  });

  it('shows a check when done', () => {
    const out = renderToString(
      <ToolCard
        toolName="read_file"
        args={{ path: 'a.ts' }}
        argsSummary="a.ts"
        status="done"
        startedAt={1000}
        elapsedMs={12}
        result="file contents here"
        resultPreview="file contents here"
        expanded={false}
        focused={false}
        theme={theme}
      />,
    );
    expect(out).toContain('✓');
  });

  it('shows a cross when failed', () => {
    const out = renderToString(
      <ToolCard
        toolName="edit"
        args={{}}
        argsSummary=""
        status="error"
        startedAt={1000}
        error="edit failed"
        expanded={false}
        focused={false}
        theme={theme}
      />,
    );
    expect(out).toContain('✗');
    expect(out).toContain('edit failed');
  });

  it('shows a cancelled state when the turn was aborted', () => {
    const out = renderToString(
      <ToolCard
        toolName="run_terminal"
        args={{ command: 'sleep 100' }}
        argsSummary="sleep 100"
        status="cancelled"
        startedAt={1000}
        expanded={false}
        focused={false}
        theme={theme}
      />,
    );
    expect(out).toContain('◼');
    expect(out).toContain('cancelled');
  });

  it('renders a colored diff view for edit when expanded', () => {
    const out = renderToString(
      <ToolCard
        toolName="edit"
        args={{ path: 'a.ts', old_str: 'foo', new_str: 'bar' }}
        argsSummary="a.ts"
        status="done"
        startedAt={1000}
        elapsedMs={5}
        result="Edited a.ts"
        expanded
        focused={false}
        theme={theme}
      />,
    );
    expect(out).toContain('- foo');
    expect(out).toContain('+ bar');
  });

  it('shows expand hint only when focused', () => {
    const out = renderToString(
      <ToolCard
        toolName="read_file"
        args={{}}
        argsSummary=""
        status="done"
        startedAt={1000}
        elapsedMs={5}
        result="x"
        expanded={false}
        focused
        theme={theme}
      />,
    );
    expect(out).toContain('expand');
  });
});
