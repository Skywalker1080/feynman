import { describe, it, expect } from 'vitest';
import {
  splitCodeBlocks,
  tokenizeLines,
  colorForClass,
  type CodeToken,
} from '../ui/highlight';
import { resolveTheme } from '../ui/theme';

const theme = resolveTheme({ noColor: false });

function classes(tokens: CodeToken[], text: string): string[] {
  return tokens.filter((t) => t.text.includes(text)).map((t) => t.className ?? '');
}

describe('splitCodeBlocks', () => {
  it('returns plain text when there are no fences', () => {
    expect(splitCodeBlocks('hello world')).toEqual([{ type: 'text', text: 'hello world' }]);
  });

  it('extracts a fenced block with its language', () => {
    expect(splitCodeBlocks('before\n```js\nconst a = 1;\n```\nafter')).toEqual([
      { type: 'text', text: 'before' },
      { type: 'code', language: 'javascript', code: 'const a = 1;' },
      { type: 'text', text: 'after' },
    ]);
  });

  it('keeps a trailing unclosed fence as code (streaming)', () => {
    expect(splitCodeBlocks('```\nconst a = 1;')).toEqual([
      { type: 'code', language: undefined, code: 'const a = 1;' },
    ]);
  });

  it('supports tilde fences', () => {
    expect(splitCodeBlocks('~~~python\nprint(1)\n~~~')).toEqual([
      { type: 'code', language: 'python', code: 'print(1)' },
    ]);
  });

  it('resolves the shell alias to bash', () => {
    expect(splitCodeBlocks('```shell\necho hi\n```')).toEqual([
      { type: 'code', language: 'bash', code: 'echo hi' },
    ]);
  });

  it('handles an empty fenced block', () => {
    expect(splitCodeBlocks('```\n```')).toEqual([{ type: 'code', language: undefined, code: '' }]);
  });
});

describe('tokenizeLines', () => {
  it('maps js tokens to classes', () => {
    const lines = tokenizeLines('const x = 1; // hi', 'javascript');
    const line = lines[0]!;
    expect(classes(line, 'const')).toContain('keyword');
    expect(classes(line, '1')).toContain('number');
    expect(classes(line, '// hi')).toContain('comment');
  });

  it('carries a string class across a line break', () => {
    const lines = tokenizeLines('const s = `line1\nline2`;', 'javascript');
    expect(classes(lines[0]!, 'line1')).toContain('string');
    expect(classes(lines[1]!, 'line2')).toContain('string');
  });

  it('highlights json keys and values', () => {
    const lines = tokenizeLines('{ "a": 1 }', 'json');
    const line = lines[0]!;
    expect(classes(line, '"a"')).toContain('attr');
    expect(classes(line, '1')).toContain('number');
  });

  it('auto-detects a language when none is given', () => {
    const lines = tokenizeLines('def foo():\n  return 1');
    expect(classes(lines[0]!, 'foo')).toContain('title');
    expect(classes(lines[1]!, 'return')).toContain('keyword');
  });

  it('returns a single empty line for empty code', () => {
    expect(tokenizeLines('', 'javascript')).toEqual([[]]);
  });
});

describe('colorForClass', () => {
  it('maps classes to theme roles', () => {
    expect(colorForClass('hljs-keyword', theme)).toBe(theme.accent);
    expect(colorForClass('hljs-string', theme)).toBe(theme.success);
    expect(colorForClass('hljs-comment', theme)).toBe(theme.muted);
  });

  it('maps unknown classes to no color', () => {
    expect(colorForClass('hljs-bogus', theme)).toBeUndefined();
    expect(colorForClass(undefined, theme)).toBeUndefined();
  });

  it('ignores the class modifier suffix', () => {
    expect(colorForClass('hljs-title function_', theme)).toBe(theme.accent);
  });

  it('respects NO_COLOR themes', () => {
    const plain = resolveTheme({ noColor: true });
    expect(colorForClass('hljs-keyword', plain)).toBeUndefined();
  });
});
