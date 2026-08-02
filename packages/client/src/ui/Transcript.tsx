import { Box, Text } from 'ink';
import type { TranscriptItem } from './conversation';
import type { Theme } from './theme';

function TranscriptRow({ item, theme }: { item: TranscriptItem; theme: Theme }) {
  switch (item.kind) {
    case 'user':
      return (
        <Box marginTop={1}>
          <Text color={theme.user} wrap="wrap">
            ❯ {item.text}
          </Text>
        </Box>
      );

    case 'assistant':
      return (
        <Box marginTop={1}>
          <Text color={theme.assistant} wrap="wrap">
            {item.streaming ? '…' : ''}
            {item.text}
          </Text>
        </Box>
      );

    case 'tool':
      return (
        <Box marginTop={1}>
          <Text color={theme.tool}>▸ {item.toolName}</Text>
          {item.argsSummary ? <Text color={theme.muted}> {item.argsSummary}</Text> : null}
          {item.resultPreview ? (
            <Text color={theme.success}> ✓ {item.resultPreview}</Text>
          ) : (
            <Text color={theme.warning}> …</Text>
          )}
        </Box>
      );

    case 'system':
      return (
        <Box marginTop={1}>
          <Text color={theme.system} wrap="wrap">
            {item.text}
          </Text>
        </Box>
      );

    case 'error':
      return (
        <Box marginTop={1}>
          <Text color={theme.error} wrap="wrap">
            ✖ {item.text}
          </Text>
        </Box>
      );
  }
}

export function Transcript({ items, theme }: { items: TranscriptItem[]; theme: Theme }) {
  if (items.length === 0) return null;

  // Newest child sits at the bottom; overflow clips the oldest rows off the top.
  return (
    <Box flexDirection="column" justifyContent="flex-end" flexGrow={1}>
      {[...items].reverse().map((item) => (
        <TranscriptRow key={item.id} item={item} theme={theme} />
      ))}
    </Box>
  );
}
