import { useMemo } from 'react';
import { Box, Text, useStdout } from 'ink';
import type { Theme } from './theme';
import { colorForClass, tokenizeLines } from './highlight';
import {
  inlineSpans,
  parseMarkdown,
  tableWidths,
  wrapSpans,
  type InlineSpan,
} from './markdown-parser';

function TableBlock({
  header,
  rows,
  theme,
  width,
}: {
  header: string[];
  rows: string[][];
  theme: Theme;
  width: number;
}) {
  const colCount = Math.max(header.length, ...rows.map((r) => r.length));
  const widths = tableWidths(header, rows, width);
  const rowLines = (row: string[]) =>
    Array.from({ length: colCount }, (_, c) =>
      wrapSpans(inlineSpans(row[c] ?? ''), Math.max(1, widths[c] ?? 1)),
    );
  const headerLines = rowLines(header);
  const bodyLines = rows.map(rowLines);
  const heightOf = (rl: InlineSpan[][][]) => rl.reduce((a, lines) => Math.max(a, lines.length), 0);
  const renderRow = (rl: InlineSpan[][][], isHeader: boolean, key: string) => (
    <Box key={key} flexDirection="column">
      {Array.from({ length: heightOf(rl) }, (_, h) => (
        <Text key={h}>
          {'│'}
          {rl.map((lines, c) => {
            const spans = lines[h] ?? [];
            const used = spans.reduce((a, s) => a + s.text.length, 0);
            return (
              <Text key={c}>
                {' '}
                <InlineText
                  spans={spans}
                  theme={theme}
                  color={isHeader ? theme.accent : theme.assistant}
                />
                {' '.repeat(Math.max(0, (widths[c] ?? 0) - used))}
                {' '}
                {c < colCount - 1 ? '│' : ''}
              </Text>
            );
          })}
          {'│'}
        </Text>
      ))}
    </Box>
  );
  const border = (left: string, mid: string, right: string) =>
    left + widths.map((w) => '─'.repeat(w + 2)).join(mid) + right;
  return (
    <Box flexDirection="column">
      <Text color={theme.muted}>{border('┌', '┬', '┐')}</Text>
      {renderRow(headerLines, true, 'header')}
      <Text color={theme.muted}>{border('├', '┼', '┤')}</Text>
      {bodyLines.map((rl, i) => (
        <Box key={`row-${i}`} flexDirection="column">
          {i > 0 && <Text color={theme.muted}>{border('├', '┼', '┤')}</Text>}
          {renderRow(rl, false, 'content')}
        </Box>
      ))}
      <Text color={theme.muted}>{border('└', '┴', '┘')}</Text>
    </Box>
  );
}

export function CodeBlock({
  language,
  code,
  theme,
}: {
  language?: string;
  code: string;
  theme: Theme;
}) {
  const lines = useMemo(() => tokenizeLines(code, language), [code, language]);
  return (
    <Box
      flexDirection="column"
      marginLeft={1}
      paddingLeft={1}
      borderStyle="single"
      borderLeft
      borderTop={false}
      borderBottom={false}
      borderRight={false}
      borderLeftColor={theme.muted}
    >
      {lines.map((tokens, i) => (
        <Box key={i} flexDirection="row" flexWrap="wrap">
          {tokens.length === 0 ? (
            <Text> </Text>
          ) : (
            tokens.map((t, j) => (
              <Text key={j} color={colorForClass(t.className, theme)}>
                {t.text}
              </Text>
            ))
          )}
        </Box>
      ))}
    </Box>
  );
}

function InlineText({
  spans,
  theme,
  color,
}: {
  spans: InlineSpan[];
  theme: Theme;
  color: string | undefined;
}) {
  return (
    <>
      {spans.map((span, i) => {
        switch (span.type) {
          case 'text':
            return (
              <Text key={i} color={color ?? theme.assistant}>
                {span.text}
              </Text>
            );
          case 'code':
            return (
              <Text key={i} color={theme.tool}>
                {span.text}
              </Text>
            );
          case 'bold':
            return (
              <Text key={i} bold color={color ?? theme.assistant}>
                {span.text}
              </Text>
            );
          case 'italic':
            return (
              <Text key={i} italic color={color ?? theme.assistant}>
                {span.text}
              </Text>
            );
          case 'bold-italic':
            return (
              <Text key={i} bold italic color={color ?? theme.assistant}>
                {span.text}
              </Text>
            );
          case 'link':
            return (
              <Text key={i} underline color={theme.accent}>
                {span.text}
              </Text>
            );
        }
      })}
    </>
  );
}

/**
 * Render assistant markdown: headings, paragraphs, lists, quotes, rules and
 * fenced code blocks, with inline bold/italic/code/links. Streaming-tolerant —
 * partial input (unclosed fences/markers) degrades gracefully.
 */
export function Markdown({
  text,
  theme,
  streaming = false,
}: {
  text: string;
  theme: Theme;
  streaming?: boolean;
}) {
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  const blocks = useMemo(() => {
    const parsed = parseMarkdown(text);
    if (streaming && parsed.length > 0) {
      const first = parsed[0];
      if (first.type === 'paragraph' || first.type === 'heading') {
        return [{ ...first, text: `… ${first.text}` }, ...parsed.slice(1)];
      }
    }
    return parsed;
  }, [text, streaming]);

  return (
    <Box flexDirection="column">
      {blocks.map((block, i) => {
        const spaced = i > 0;
        switch (block.type) {
          case 'paragraph':
            return (
              <Box key={i} marginTop={spaced ? 1 : 0}>
                <Text wrap="wrap">
                  <InlineText
                    spans={inlineSpans(block.text)}
                    theme={theme}
                    color={theme.assistant}
                  />
                </Text>
              </Box>
            );
          case 'heading':
            // Heading markers are not shown — render the heading text plainly.
            return (
              <Box key={i} marginTop={spaced ? 1 : 0}>
                <Text wrap="wrap">
                  <InlineText
                    spans={inlineSpans(block.text)}
                    theme={theme}
                    color={theme.assistant}
                  />
                </Text>
              </Box>
            );
          case 'quote':
            return (
              <Box key={i} marginTop={spaced ? 1 : 0}>
                <Text wrap="wrap">
                  {block.text.split('\n').map((line, j, lines) => (
                    <Text key={j}>
                      <Text color={theme.muted}>│ </Text>
                      <InlineText
                        spans={inlineSpans(line)}
                        theme={theme}
                        color={theme.system}
                      />
                      {j < lines.length - 1 ? '\n' : ''}
                    </Text>
                  ))}
                </Text>
              </Box>
            );
          case 'list':
            return (
              <Box key={i} marginTop={spaced ? 1 : 0}>
                <Text wrap="wrap">
                  <Text color={theme.muted}>{block.marker}</Text>
                  <InlineText
                    spans={inlineSpans(block.text)}
                    theme={theme}
                    color={theme.assistant}
                  />
                </Text>
              </Box>
            );
          case 'rule':
            return (
              <Box key={i} marginTop={spaced ? 1 : 0}>
                <Text color={theme.muted}>────────────</Text>
              </Box>
            );
          case 'code':
            return (
              <Box key={i} marginTop={spaced ? 1 : 0}>
                <CodeBlock language={block.language} code={block.code} theme={theme} />
              </Box>
            );
          case 'table':
            return (
              <Box key={i} marginTop={spaced ? 1 : 0}>
                <TableBlock header={block.header} rows={block.rows} theme={theme} width={width} />
              </Box>
            );
        }
      })}
    </Box>
  );
}
