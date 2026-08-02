import { describe, it, expect } from 'vitest';
import { renderToString } from 'ink';
import type { Session } from '@feynman/types';
import { Header } from '../ui/Header';
import { StatusBar } from '../ui/StatusBar';
import { Transcript } from '../ui/Transcript';
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
  });

  it('StatusBar shows a working state when busy', () => {
    const out = renderToString(<StatusBar session={session} busy theme={theme} />);
    expect(out).toContain('working');
  });

  it('Transcript renders user, assistant, tool and system rows', () => {
    const items: TranscriptItem[] = [
      { kind: 'user', id: 1, text: 'hello' },
      { kind: 'assistant', id: 2, text: 'hi', streaming: false },
      { kind: 'tool', id: 3, toolName: 'read_file' },
      { kind: 'system', id: 4, text: 'note' },
      { kind: 'error', id: 5, text: 'boom' },
    ];
    const out = renderToString(<Transcript items={items} theme={theme} />);
    expect(out).toContain('hello');
    expect(out).toContain('hi');
    expect(out).toContain('read_file');
    expect(out).toContain('note');
    expect(out).toContain('boom');
  });

  it('Transcript renders nothing when empty', () => {
    const out = renderToString(<Transcript items={[]} theme={theme} />);
    expect(out).toBe('');
  });
});
