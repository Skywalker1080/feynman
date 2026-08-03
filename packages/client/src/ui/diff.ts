export type DiffLineType = 'add' | 'remove' | 'same';

export interface DiffLine {
  type: DiffLineType;
  text: string;
}

/**
 * Line-based diff of two strings. Produces a list of lines tagged
 * add/remove/same. A simple LCS-based algorithm keeps output stable and
 * deterministic (no dependency on a native diff binary).
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  if (oldText === '' && newText === '') return [];
  const a = oldText === '' ? [] : oldText.split('\n');
  const b = newText === '' ? [] : newText.split('\n');

  // LCS DP table
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i]![j] = dp[i + 1]![j + 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
      }
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ type: 'remove', text: a[i]! });
      i++;
    } else {
      out.push({ type: 'add', text: b[j]! });
      j++;
    }
  }
  while (i < n) {
    out.push({ type: 'remove', text: a[i]! });
    i++;
  }
  while (j < m) {
    out.push({ type: 'add', text: b[j]! });
    j++;
  }
  return out;
}
