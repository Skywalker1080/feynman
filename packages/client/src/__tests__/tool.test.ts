import { describe, it, expect } from 'vitest';
import { diffLines } from '../ui/diff';
import { summarizeArgs, truncate } from '../ui/tool';

describe('diffLines', () => {
  it('returns identical lines as same', () => {
    expect(diffLines('a\nb', 'a\nb')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'same', text: 'b' },
    ]);
  });

  it('tags added and removed lines', () => {
    expect(diffLines('foo', 'bar')).toEqual([
      { type: 'remove', text: 'foo' },
      { type: 'add', text: 'bar' },
    ]);
  });

  it('keeps common context in the middle', () => {
    expect(diffLines('a\nkeep\nold', 'a\nkeep\nnew')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'same', text: 'keep' },
      { type: 'remove', text: 'old' },
      { type: 'add', text: 'new' },
    ]);
  });

  it('handles pure insertion', () => {
    expect(diffLines('a\nc', 'a\nb\nc')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'add', text: 'b' },
      { type: 'same', text: 'c' },
    ]);
  });

  it('handles empty inputs', () => {
    expect(diffLines('', '')).toEqual([]);
    expect(diffLines('', 'x')).toEqual([{ type: 'add', text: 'x' }]);
    expect(diffLines('x', '')).toEqual([{ type: 'remove', text: 'x' }]);
  });
});

describe('summarizeArgs', () => {
  it('summarizes edit and write_file with a verb + path', () => {
    expect(summarizeArgs('edit', { path: 'src/a.ts', old_str: 'x', new_str: 'y' })).toBe(
      'Edit src/a.ts',
    );
    expect(summarizeArgs('write_file', { path: 'README.md', content: 'hi' })).toBe(
      'Write README.md',
    );
  });

  it('summarizes run_terminal as a run line', () => {
    expect(summarizeArgs('run_terminal', { command: 'npm test' })).toBe('Run: npm test');
  });

  it('summarizes search by pattern', () => {
    expect(summarizeArgs('search', { pattern: 'todo' })).toBe('Search "todo"');
    expect(summarizeArgs('search', { pattern: 'todo', path: 'src' })).toBe(
      'Search "todo" in src',
    );
  });

  it('summarizes read_file with a path and optional offsets', () => {
    expect(summarizeArgs('read_file', { path: 'a.ts' })).toBe('Read a.ts');
    expect(summarizeArgs('read_file', { path: 'a.ts', offset: 190, limit: 120 })).toBe(
      'Read a.ts [offset=190, limit=120]',
    );
  });

  it('falls back to JSON for unknown tools', () => {
    expect(summarizeArgs('mystery', { a: 1 })).toBe('{"a":1}');
  });
});

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('abc', 10)).toBe('abc');
  });

  it('adds an ellipsis past the max length', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcd…');
  });
});
