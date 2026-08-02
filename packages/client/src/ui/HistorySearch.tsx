import { Box, Text } from 'ink';
import type { Theme } from './theme';

export function HistorySearch({
  query,
  results,
  index,
  theme,
}: {
  query: string;
  results: string[];
  index: number;
  theme: Theme;
}) {
  const safe = Math.min(index, Math.max(results.length - 1, 0));
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={theme.system}>reverse-search{query ? `: ${query}` : ''}</Text>
      {results.length === 0 ? (
        <Text color={theme.muted}>no matches</Text>
      ) : (
        results.slice(0, 8).map((r, i) => (
          <Text key={`${r}${i}`} color={i === safe ? theme.accent : theme.muted}>
            {i === safe ? '› ' : '  '}
            {r}
          </Text>
        ))
      )}
    </Box>
  );
}
