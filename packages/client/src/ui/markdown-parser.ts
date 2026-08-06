/**
 * Minimal, streaming-tolerant Markdown parsing for the transcript.
 *
 * The assistant text streams in token by token, so the parser must never throw
 * on partial input: an unclosed code fence stays a code block, an unclosed
 * `**bold**` marker stays literal text, and so on. Output is a small tagged
 * union that a React renderer turns into Ink elements.
 */

export type MdBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; marker: string; text: string }
  | { type: 'rule' }
  | { type: 'code'; language?: string; code: string }
  | { type: 'table'; header: string[]; rows: string[][] };

export type InlineSpan =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'bold-italic'; text: string }
  | { type: 'link'; text: string; url: string };

const FENCE_RE = /^[ \t]*(`{3,}|~{3,})(.*)$/;
const HEADING_RE = /^(#{1,6})[ \t]+(.+)$/;
const RULE_RE = /^[ \t]*(-{3,}|\*{3,}|_{3,})[ \t]*$/;
const QUOTE_RE = /^[ \t]*>[ \t]?(.*)$/;
const UL_RE = /^[ \t]*([-*+])[ \t]+(.+)$/;
const OL_RE = /^[ \t]*(\d+)([.)])[ \t]+(.+)$/;
const TABLE_ROW_RE = /^[ \t]*\|.*\|[ \t]*$/;

/** A GFM table separator row: `| --- | :--: |` etc. */
function isTableSeparator(line: string): boolean {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  if (!t) return false;
  return t.split('|').every((cell) => /^:?-+:?$/.test(cell.trim()));
}

/** Split a pipe row into trimmed cells (outer pipes optional). */
function splitTableRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((cell) => cell.trim());
}

/** A row that could be a table header (needs at least two columns). */
function isTableRow(line: string): boolean {
  return TABLE_ROW_RE.test(line) && splitTableRow(line).length >= 2;
}

export function parseMarkdown(text: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const para: string[] = [];
  const quote: string[] = [];
  let codeLines: string[] = [];
  let codeLang: string | undefined;
  let inCode = false;
  /** A pipe row awaiting a separator line — it may become a table header. */
  let pendingRow: string | null = null;
  /** An active table awaiting more rows. */
  let table: { header: string[]; rows: string[][] } | null = null;

  const flushPara = (): void => {
    if (para.length > 0) {
      blocks.push({ type: 'paragraph', text: para.join('\n') });
      para.length = 0;
    }
  };
  const flushQuote = (): void => {
    if (quote.length > 0) {
      blocks.push({ type: 'quote', text: quote.join('\n') });
      quote.length = 0;
    }
  };
  const flush = (): void => {
    flushPara();
    flushQuote();
    if (pendingRow !== null) {
      para.push(pendingRow);
      pendingRow = null;
      flushPara();
    }
    if (table !== null) {
      blocks.push({ type: 'table', header: table.header, rows: table.rows });
      table = null;
    }
  };

  for (const line of text.split('\n')) {
    if (inCode) {
      const fm = FENCE_RE.exec(line);
      if (fm) {
        blocks.push({ type: 'code', language: codeLang, code: codeLines.join('\n') });
        codeLines = [];
        codeLang = undefined;
        inCode = false;
        flush();
      } else {
        codeLines.push(line);
      }
      continue;
    }

    const fm = FENCE_RE.exec(line);
    if (fm) {
      flush();
      inCode = true;
      codeLang = fm[2]?.trim() || undefined;
      codeLines = [];
      continue;
    }

    if (line.trim() === '') {
      flush();
      continue;
    }

    if (pendingRow !== null) {
      if (isTableSeparator(line)) {
        flushPara();
        flushQuote();
        table = { header: splitTableRow(pendingRow), rows: [] };
        pendingRow = null;
        continue;
      }
      para.push(pendingRow);
      pendingRow = null;
    }

    if (table !== null) {
      if (isTableRow(line)) {
        table.rows.push(splitTableRow(line));
        continue;
      }
      blocks.push({ type: 'table', header: table.header, rows: table.rows });
      table = null;
    }

    if (isTableRow(line)) {
      pendingRow = line;
      continue;
    }

    const hm = HEADING_RE.exec(line);
    if (hm) {
      flush();
      blocks.push({ type: 'heading', level: hm[1]!.length, text: hm[2]! });
      continue;
    }

    if (RULE_RE.test(line)) {
      flush();
      blocks.push({ type: 'rule' });
      continue;
    }

    const qm = QUOTE_RE.exec(line);
    if (qm) {
      flushPara();
      quote.push(qm[1]!);
      continue;
    }

    const um = UL_RE.exec(line);
    if (um) {
      flush();
      blocks.push({ type: 'list', marker: `${um[1]!} `, text: um[2]! });
      continue;
    }

    const om = OL_RE.exec(line);
    if (om) {
      flush();
      blocks.push({ type: 'list', marker: `${om[1]}${om[2]!} `, text: om[3]! });
      continue;
    }

    para.push(line);
  }

  if (inCode) {
    // Unclosed trailing fence — the code is still streaming.
    blocks.push({ type: 'code', language: codeLang, code: codeLines.join('\n') });
  }
  flush();
  return blocks;
}

// Order matters: longer markers first so `***x***` wins over `**x**`.
const INLINE_RE =
  /\*\*\*([^*]+)\*\*\*|`([^`\n]*)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|_([^_\n]+)_|\[([^\]]+)\]\(([^)]*)\)/;

export function inlineSpans(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let rest = text;
  let m: RegExpExecArray | null;
  while ((m = INLINE_RE.exec(rest))) {
    if (m.index > 0) spans.push({ type: 'text', text: rest.slice(0, m.index) });
    if (m[1] !== undefined) spans.push({ type: 'bold-italic', text: m[1] });
    else if (m[2] !== undefined) spans.push({ type: 'code', text: m[2] });
    else if (m[3] !== undefined) spans.push({ type: 'bold', text: m[3] });
    else if (m[4] !== undefined) spans.push({ type: 'bold', text: m[4] });
    else if (m[5] !== undefined) spans.push({ type: 'italic', text: m[5] });
    else if (m[6] !== undefined) spans.push({ type: 'italic', text: m[6] });
    else spans.push({ type: 'link', text: m[7]!, url: m[8] ?? '' });
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest.length > 0) spans.push({ type: 'text', text: rest });
  return spans;
}

export const MAX_CELL_WIDTH = 40;

/** Rendered length of a cell after inline markdown markers are stripped. */
export function visibleLength(text: string): number {
  return text
    .replace(/`([^`\n]*)`/g, '$1')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .length;
}

/** Word-wrap spans into lines at most `width` chars wide, keeping span type on breaks. */
export function wrapSpans(spans: InlineSpan[], width: number): InlineSpan[][] {
  const col = Math.max(1, width);
  const lines: InlineSpan[][] = [];
  let line: InlineSpan[] = [];
  let len = 0;
  const flush = () => {
    lines.push(line);
    line = [];
    len = 0;
  };
  const put = (span: InlineSpan, text: string) => {
    let rest = text;
    while (rest.length > col) {
      if (len > 0) flush();
      line.push({ ...span, text: rest.slice(0, col) });
      flush();
      rest = rest.slice(col);
    }
    if (len > 0 && len + rest.length > col) flush();
    if (rest.length > 0) {
      line.push({ ...span, text: rest });
      len += rest.length;
    }
  };
  for (const span of spans) {
    const words = span.text.match(/\S+\s*/g) ?? [];
    if (words.length === 0) continue;
    for (const word of words) put(span, word);
  }
  if (line.length > 0 || lines.length === 0) lines.push(line);
  return lines;
}

/** Column widths for a table, capped and shrunk to fit `maxWidth` (table borders included). */
export function tableWidths(header: string[], rows: string[][], maxWidth: number): number[] {
  const colCount = Math.max(header.length, ...rows.map((r) => r.length));
  const natural = Array.from({ length: colCount }, (_, c) =>
    Math.min(
      MAX_CELL_WIDTH,
      Math.max(visibleLength(header[c] ?? ''), ...rows.map((r) => visibleLength(r[c] ?? ''))),
    ),
  );
  // Borders + separators + padding occupy `3 * colCount + 1` columns.
  const budget = Math.max(colCount, Math.max(1, maxWidth) - 4 - (3 * colCount + 1));
  const widths = [...natural];
  while (widths.reduce((a, b) => a + b, 0) > budget) {
    const max = Math.max(...widths);
    if (max <= 1) break;
    widths[widths.indexOf(max)] = max - 1;
  }
  return widths;
}

function textRows(text: string, columns: number): number {
  const col = Math.max(1, columns);
  let rows = 0;
  for (const line of text.split('\n')) {
    rows += Math.max(1, Math.ceil(line.length / col));
  }
  return Math.max(1, rows);
}

/** Approximate rendered rows of markdown, used by the transcript virtualizer. */
export function estimateMarkdownRows(text: string, columns: number): number {
  const blocks = parseMarkdown(text);
  if (blocks.length === 0) return 1;
  let rows = blocks.length - 1; // inter-block margins
  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
      case 'quote':
      case 'list':
        rows += textRows(block.text, columns);
        break;
      case 'rule':
        rows += 1;
        break;
      case 'code':
        rows += block.code.split('\n').length;
        break;
      case 'table': {
        const widths = tableWidths(block.header, block.rows, columns);
        const cellRows = (cell: string, c: number) =>
          wrapSpans(inlineSpans(cell), Math.max(1, widths[c] ?? 1)).length;
        // top + bottom borders, header separator, and dividers between body rows
        let table = 3 + Math.max(0, block.rows.length - 1);
        table += Math.max(0, ...block.header.map((h, c) => cellRows(h, c)));
        for (const row of block.rows) {
          table += Math.max(0, ...row.map((cell, c) => cellRows(cell, c)));
        }
        rows += table;
        break;
      }
    }
  }
  return Math.max(1, rows);
}
