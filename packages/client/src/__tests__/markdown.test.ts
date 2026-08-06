import { describe, it, expect } from 'vitest';
import { estimateMarkdownRows, inlineSpans, parseMarkdown, tableWidths, wrapSpans } from '../ui/markdown-parser';

describe('parseMarkdown', () => {
  it('treats plain text as one paragraph', () => {
    expect(parseMarkdown('hello world')).toEqual([{ type: 'paragraph', text: 'hello world' }]);
  });

  it('parses headings', () => {
    expect(parseMarkdown('# Title')).toEqual([{ type: 'heading', level: 1, text: 'Title' }]);
    expect(parseMarkdown('### Sub')).toEqual([{ type: 'heading', level: 3, text: 'Sub' }]);
  });

  it('parses bullet and ordered lists', () => {
    expect(parseMarkdown('- one')).toEqual([{ type: 'list', marker: '- ', text: 'one' }]);
    expect(parseMarkdown('1. first')).toEqual([{ type: 'list', marker: '1. ', text: 'first' }]);
    expect(parseMarkdown('* star')).toEqual([{ type: 'list', marker: '* ', text: 'star' }]);
  });

  it('parses blockquotes', () => {
    expect(parseMarkdown('> quoted')).toEqual([{ type: 'quote', text: 'quoted' }]);
  });

  it('parses horizontal rules', () => {
    expect(parseMarkdown('---')).toEqual([{ type: 'rule' }]);
  });

  it('splits fenced code into a code block with its language', () => {
    expect(parseMarkdown('before\n```ts\nconst a = 1;\n```\nafter')).toEqual([
      { type: 'paragraph', text: 'before' },
      { type: 'code', language: 'ts', code: 'const a = 1;' },
      { type: 'paragraph', text: 'after' },
    ]);
  });

  it('keeps an unclosed trailing fence as code (streaming)', () => {
    expect(parseMarkdown('```\nconst a = 1;')).toEqual([
      { type: 'code', language: undefined, code: 'const a = 1;' },
    ]);
  });

  it('keeps a partially written heading marker literal (streaming)', () => {
    expect(parseMarkdown('# ')).toEqual([{ type: 'paragraph', text: '# ' }]);
    expect(parseMarkdown('# N')).toEqual([{ type: 'heading', level: 1, text: 'N' }]);
  });

  it('parses a GFM table into header and rows', () => {
    expect(
      parseMarkdown('| Lib | Use |\n|---|---|\n| fastai | CV |\n| numpy | math |'),
    ).toEqual([
      {
        type: 'table',
        header: ['Lib', 'Use'],
        rows: [
          ['fastai', 'CV'],
          ['numpy', 'math'],
        ],
      },
    ]);
  });

  it('keeps a pipe row as a paragraph until its separator appears (streaming)', () => {
    expect(parseMarkdown('| Lib | Use |')).toEqual([{ type: 'paragraph', text: '| Lib | Use |' }]);
  });

  it('keeps adjacent pipe rows as paragraphs when there is no separator', () => {
    expect(parseMarkdown('| A | B |\n| C | D |')).toEqual([
      { type: 'paragraph', text: '| A | B |' },
      { type: 'paragraph', text: '| C | D |' },
    ]);
  });

  it('ends a table at a non-row line', () => {
    expect(parseMarkdown('| A | B |\n|---|---|\n| x | y |\n\nafter')).toEqual([
      {
        type: 'table',
        header: ['A', 'B'],
        rows: [['x', 'y']],
      },
      { type: 'paragraph', text: 'after' },
    ]);
  });

  it('preserves empty lines inside paragraphs as line breaks', () => {
    expect(parseMarkdown('a\n\nb')).toEqual([
      { type: 'paragraph', text: 'a' },
      { type: 'paragraph', text: 'b' },
    ]);
  });
});

describe('inlineSpans', () => {
  it('returns plain text unchanged', () => {
    expect(inlineSpans('hi there')).toEqual([{ type: 'text', text: 'hi there' }]);
  });

  it('parses bold', () => {
    expect(inlineSpans('a **bold** b')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'bold', text: 'bold' },
      { type: 'text', text: ' b' },
    ]);
  });

  it('parses italic', () => {
    expect(inlineSpans('a *it* b')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'italic', text: 'it' },
      { type: 'text', text: ' b' },
    ]);
  });

  it('parses bold-italic before plain bold', () => {
    expect(inlineSpans('***both*** and **bold**')).toEqual([
      { type: 'bold-italic', text: 'both' },
      { type: 'text', text: ' and ' },
      { type: 'bold', text: 'bold' },
    ]);
  });

  it('parses inline code', () => {
    expect(inlineSpans('run `npm i` now')).toEqual([
      { type: 'text', text: 'run ' },
      { type: 'code', text: 'npm i' },
      { type: 'text', text: ' now' },
    ]);
  });

  it('parses links', () => {
    expect(inlineSpans('see [docs](https://x.io)')).toEqual([
      { type: 'text', text: 'see ' },
      { type: 'link', text: 'docs', url: 'https://x.io' },
    ]);
  });

  it('keeps an unclosed bold marker literal (streaming)', () => {
    expect(inlineSpans('a **bold')).toEqual([{ type: 'text', text: 'a **bold' }]);
  });

  it('keeps an unclosed backtick literal (streaming)', () => {
    expect(inlineSpans('run `npm')).toEqual([{ type: 'text', text: 'run `npm' }]);
  });
});

describe('wrapSpans', () => {
  it('wraps a long span across lines at word boundaries', () => {
    const spans = [{ type: 'text' as const, text: 'one two three four' }];
    const lines = wrapSpans(spans, 8);
    expect(lines.map((l) => l.map((s) => s.text).join(''))).toEqual([
      'one two ',
      'three ',
      'four',
    ]);
  });

  it('keeps span type on continuation lines', () => {
    const spans = [{ type: 'bold' as const, text: 'Open-source machine learning' }];
    const lines = wrapSpans(spans, 12);
    expect(lines).toEqual([
      [{ type: 'bold', text: 'Open-source ' }],
      [{ type: 'bold', text: 'machine ' }],
      [{ type: 'bold', text: 'learning' }],
    ]);
  });

  it('hard-breaks unbroken long words', () => {
    const lines = wrapSpans([{ type: 'text' as const, text: 'abcdefghij' }], 4);
    expect(lines.map((l) => l[0].text)).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('returns one empty line for empty input', () => {
    expect(wrapSpans([], 5)).toEqual([[]]);
  });
});

describe('tableWidths', () => {
  it('uses natural widths up to the cell cap', () => {
    const long = 'a very long header cell that is huge';
    const widths = tableWidths(['A', long], [['x', 'short']], 120);
    expect(widths[1]).toBe(long.length);
  });

  it('caps natural widths at the cell cap', () => {
    const widths = tableWidths(
      ['A', 'x'.repeat(80)],
      [['x', 'short']],
      120,
    );
    expect(widths[1]).toBe(40);
  });

  it('shrinks columns to fit a narrow width', () => {
    const widths = tableWidths(['AAA', 'BBB'], [['ccc', 'ddd']], 20);
    expect(widths.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(20 - 4 - (3 * 2 + 1));
  });
});

describe('estimateMarkdownRows', () => {  it('matches plain-text estimates', () => {
    expect(estimateMarkdownRows('hi', 80)).toBe(1);
    expect(estimateMarkdownRows('abcdef', 5)).toBe(2);
    expect(estimateMarkdownRows('a\nb\nc', 80)).toBe(3);
  });

  it('counts each code line plus inter-block margins', () => {
    expect(estimateMarkdownRows('intro\n```\nconst a = 1;\nconst b = 2;\n```', 80)).toBe(
      1 + 1 + 2,
    );
  });

  it('counts list and heading blocks with margins between them', () => {
    expect(estimateMarkdownRows('# Head\n- one\n- two', 80)).toBe(1 + 1 + 1 + 1 + 1);
  });

  it('returns at least one row for empty text', () => {
    expect(estimateMarkdownRows('', 80)).toBe(1);
  });

  it('counts a table as borders, header, separators and rows', () => {
    expect(estimateMarkdownRows('| A | B |\n|---|---|\n| x | y |\n| z | w |', 80)).toBe(7);
  });

  it('counts wrapped cell lines in a wide table', () => {
    const big =
      '| F | D |\n|---|----|\n' +
      '| PyTorch | Open-source machine learning framework for building and training neural networks. |\n' +
      '| NumPy | Fast numerical computation. |';
    // 4 borders + 1 header + 3 wrapped description lines + 1 short row = 9
    expect(estimateMarkdownRows(big, 80)).toBe(9);
  });
});
