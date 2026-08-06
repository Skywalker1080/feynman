import { describe, it, expect } from 'vitest';
import { renderToString } from 'ink';
import { Markdown } from '../ui/Markdown';
import { resolveTheme } from '../ui/theme';

const theme = resolveTheme({ noColor: true });

describe('Markdown', () => {
  it('renders paragraphs and headings without heading markers', () => {
    const out = renderToString(<Markdown text={'# Title\n## Sub\nsome text'} theme={theme} />);
    expect(out).toContain('Title');
    expect(out).toContain('Sub');
    expect(out).not.toContain('#');
    expect(out).toContain('some text');
  });

  it('renders bullet and ordered lists with markers', () => {
    const out = renderToString(<Markdown text={'- one\n- two'} theme={theme} />);
    expect(out).toContain('- one');
    expect(out).toContain('- two');
  });

  it('renders blockquotes with a vertical bar prefix', () => {
    const out = renderToString(<Markdown text="> quoted" theme={theme} />);
    expect(out).toContain('│ quoted');
  });

  it('renders inline bold and code', () => {
    const out = renderToString(<Markdown text="run `npm i` **now**" theme={theme} />);
    expect(out).toContain('npm i');
    expect(out).toContain('now');
  });

  it('syntax-highlights fenced code blocks', () => {
    const out = renderToString(
      <Markdown text={'Here is some code:\n```js\nconst a = 1;\n```'} theme={theme} />,
    );
    expect(out).toContain('Here is some code:');
    expect(out).toContain('const a = 1;');
  });

  it('renders a table with box-drawing borders and column separators', () => {
    const out = renderToString(
      <Markdown
        text={'| Lib | Use |\n|---|---|\n| fastai | CV |\n| numpy | math |'}
        theme={theme}
      />,
    );
    expect(out).toContain('Lib');
    expect(out).toContain('Use');
    expect(out).toContain('fastai');
    expect(out).toContain('numpy');
    expect(out).toContain('math');
    expect(out).toContain('┌');
    expect(out).toContain('└');
    expect(out).toContain('│');
    expect(out).not.toContain('---');
    // one header separator plus one divider between the two rows
    expect(out.match(/├/g)?.length).toBe(2);
  });

  it('renders bold inside table cells', () => {
    const out = renderToString(
      <Markdown text={'| Lib | Use |\n|---|-----|\n| **fastai** | CV |'} theme={theme} />,
    );
    expect(out).toContain('fastai');
    expect(out).not.toContain('**');
  });

  it('wraps long cell text inside the borders', () => {
    const out = renderToString(
      <Markdown
        text={
          '| Framework | Description |\n|---|---|\n' +
          '| PyTorch | Open-source machine learning framework for building and training neural networks, with dynamic computation graphs and GPU acceleration. |'
        }
        theme={theme}
      />,
    );
    expect(out).toContain('for building and training');
    const lines = out.split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThan(4);
    for (const line of lines) {
      expect(['│', '┌', '├', '└'].some((c) => line.startsWith(c))).toBe(true);
    }
  });

  it('prefixes streaming text with an ellipsis', () => {
    const out = renderToString(<Markdown text="working…" theme={theme} streaming />);
    expect(out).toContain('… working…');
  });

  it('renders partial markdown without throwing (streaming)', () => {
    const out = renderToString(<Markdown text={'a **bold\n```\nconst x = 1;'} theme={theme} />);
    expect(out).toContain('a **bold');
    expect(out).toContain('const x = 1;');
  });
});
