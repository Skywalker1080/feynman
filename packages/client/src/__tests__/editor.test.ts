import { describe, it, expect } from 'vitest';
import {
  createEditor,
  setValue,
  insertChar,
  deleteBefore,
  deleteAfter,
  moveLeft,
  moveRight,
  moveHome,
  moveEnd,
  cursorRowCol,
  lines,
} from '../ui/editor';

describe('editor', () => {
  it('creates an editor with cursor at the end', () => {
    const e = createEditor('abc');
    expect(e.value).toBe('abc');
    expect(e.cursor).toBe(3);
  });

  it('inserts a character at the cursor', () => {
    let e = createEditor('ac');
    e = moveLeft(e);
    e = insertChar(e, 'b');
    expect(e).toEqual({ value: 'abc', cursor: 2 });
  });

  it('inserts a newline at the cursor (Shift+Enter)', () => {
    let e = createEditor('ab');
    e = moveLeft(e);
    e = insertChar(e, '\n');
    expect(e.value).toBe('a\nb');
    expect(e.cursor).toBe(2);
  });

  it('deletes the character before the cursor', () => {
    let e = createEditor('abc');
    e = moveLeft(e);
    e = deleteBefore(e);
    expect(e.value).toBe('ac');
    expect(e.cursor).toBe(1);
  });

  it('does nothing when deleting at the start', () => {
    const e = deleteBefore(createEditor(''));
    expect(e.value).toBe('');
  });

  it('deletes the character after the cursor', () => {
    let e = createEditor('abc');
    e = moveHome(e);
    e = deleteAfter(e);
    expect(e.value).toBe('bc');
  });

  it('moves the cursor with arrow keys, clamped to bounds', () => {
    let e = createEditor('abc');
    e = moveHome(e);
    e = moveRight(e);
    expect(e.cursor).toBe(1);
    e = moveLeft(e);
    e = moveLeft(e);
    expect(e.cursor).toBe(0);
    e = moveEnd(e);
    e = moveRight(e);
    expect(e.cursor).toBe(3);
  });

  it('computes row/col across newlines', () => {
    const e = createEditor('ab\ncd\nef');
    expect(cursorRowCol(e.value, e.cursor)).toEqual({ row: 2, col: 2 });
    expect(cursorRowCol(e.value, 2)).toEqual({ row: 0, col: 2 });
    expect(cursorRowCol(e.value, 4)).toEqual({ row: 1, col: 1 });
  });

  it('splits the buffer into lines', () => {
    expect(lines('a\nb\nc')).toEqual(['a', 'b', 'c']);
  });

  it('setValue replaces the buffer', () => {
    expect(setValue(createEditor('old'), 'new')).toEqual({ value: 'new', cursor: 3 });
  });
});
