import { describe, it, expect } from 'vitest';
import { createHistory, pushHistory, historyUp, historyDown, historySearch } from '../ui/history';

describe('history', () => {
  it('starts empty with index -1', () => {
    const h = createHistory();
    expect(h.entries).toEqual([]);
    expect(h.index).toBe(-1);
  });

  it('pushes entries newest-first and dedupes', () => {
    let h = createHistory();
    h = pushHistory(h, 'first');
    h = pushHistory(h, 'second');
    h = pushHistory(h, 'first');
    expect(h.entries).toEqual(['first', 'second']);
  });

  it('ignores blank entries', () => {
    let h = createHistory();
    h = pushHistory(h, '   ');
    expect(h.entries).toEqual([]);
  });

  it('walks up and down the history', () => {
    let h = createHistory();
    h = pushHistory(h, 'a');
    h = pushHistory(h, 'b');
    h = pushHistory(h, 'c');

    const up1 = historyUp(h);
    expect(up1.value).toBe('c');
    const up2 = historyUp({ ...h, index: up1.index });
    expect(up2.value).toBe('b');
    const up3 = historyUp({ ...h, index: up2.index });
    expect(up3.value).toBe('a');
    // clamps at oldest
    const up4 = historyUp({ ...h, index: up3.index });
    expect(up4.value).toBe('a');

    const down = historyDown({ ...h, index: up2.index });
    expect(down.value).toBe('c');
    // back to fresh input
    const downToFresh = historyDown({ ...h, index: up1.index });
    expect(downToFresh.index).toBe(-1);
    expect(downToFresh.value).toBe('');
  });

  it('does nothing on up when empty', () => {
    const h = createHistory();
    expect(historyUp(h).value).toBe('');
  });

  it('searches entries by substring, newest first', () => {
    let h = createHistory();
    h = pushHistory(h, 'list files');
    h = pushHistory(h, 'read the plan');
    h = pushHistory(h, 'list dir');
    expect(historySearch(h, 'list')).toEqual(['list dir', 'list files']);
    expect(historySearch(h, '')).toEqual([]);
    expect(historySearch(h, 'nope')).toEqual([]);
  });
});
