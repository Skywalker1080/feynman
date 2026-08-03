import { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { Theme } from './theme';
import { colorForClass, splitCodeBlocks, tokenizeLines } from './highlight';

function CodeBlock({
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
      marginTop={1}
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

/** Render assistant text with markdown fenced code blocks syntax-highlighted. */
export function HighlightedText({ text, theme }: { text: string; theme: Theme }) {
  const parts = useMemo(() => splitCodeBlocks(text), [text]);
  if (parts.length === 0) return null;
  return (
    <>
      {parts.map((part, i) =>
        part.type === 'text' ? (
          <Text key={i} color={theme.assistant} wrap="wrap">
            {part.text}
          </Text>
        ) : (
          <CodeBlock key={i} language={part.language} code={part.code} theme={theme} />
        ),
      )}
    </>
  );
}
