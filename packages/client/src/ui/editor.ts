export interface EditorState {
  value: string;
  cursor: number;
}

export function createEditor(value = ''): EditorState {
  return { value, cursor: value.length };
}

/** Replace the whole buffer (e.g. loading a history entry); cursor goes to the end. */
export function setValue(s: EditorState, value: string): EditorState {
  return { value, cursor: value.length };
}

export function insertChar(s: EditorState, ch: string): EditorState {
  return {
    value: s.value.slice(0, s.cursor) + ch + s.value.slice(s.cursor),
    cursor: s.cursor + ch.length,
  };
}

export function deleteBefore(s: EditorState): EditorState {
  if (s.cursor <= 0) return s;
  return {
    value: s.value.slice(0, s.cursor - 1) + s.value.slice(s.cursor),
    cursor: s.cursor - 1,
  };
}

export function deleteAfter(s: EditorState): EditorState {
  if (s.cursor >= s.value.length) return s;
  return {
    value: s.value.slice(0, s.cursor) + s.value.slice(s.cursor + 1),
    cursor: s.cursor,
  };
}

export function moveLeft(s: EditorState): EditorState {
  return { ...s, cursor: Math.max(0, s.cursor - 1) };
}

export function moveRight(s: EditorState): EditorState {
  return { ...s, cursor: Math.min(s.value.length, s.cursor + 1) };
}

export function moveHome(s: EditorState): EditorState {
  return { ...s, cursor: 0 };
}

export function moveEnd(s: EditorState): EditorState {
  return { ...s, cursor: s.value.length };
}

/** Row/col (0-indexed) of the cursor in the buffer, for caret rendering. */
export function cursorRowCol(value: string, cursor: number): { row: number; col: number } {
  const before = value.slice(0, cursor);
  const lines = before.split('\n');
  return { row: lines.length - 1, col: lines[lines.length - 1]?.length ?? 0 };
}

/** Split the buffer into visible lines for rendering. */
export function lines(value: string): string[] {
  return value.split('\n');
}

export function isEmpty(s: EditorState): boolean {
  return s.value.length === 0;
}
