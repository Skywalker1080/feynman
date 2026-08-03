import { Box, Text } from 'ink';
import type { TranscriptItem } from './conversation';
import type { Theme } from './theme';
import { ToolCard } from './ToolCard';

interface TranscriptProps {
  items: TranscriptItem[];
  theme: Theme;
  /** Tool navigation is active — a tool card is focused and keys move the selection. */
  navActive: boolean;
  /** toolCallId of the currently selected tool card, when navActive. */
  selectedToolCallId: string | null;
}

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

export function Transcript({ items, theme, navActive, selectedToolCallId }: TranscriptProps) {
  if (items.length === 0) return null;

  // Newest child sits at the bottom; overflow clips the oldest rows off the top.
  return (
    <Box flexDirection="column" justifyContent="flex-end" flexGrow={1}>
      {[...items]
        .reverse()
        .map((item) =>
          item.kind === 'tool' ? (
            <ToolCard
              key={item.id}
              toolName={item.toolName}
              args={item.args}
              argsSummary={item.argsSummary}
              status={item.status}
              startedAt={item.startedAt}
              elapsedMs={item.elapsedMs}
              result={item.result}
              resultPreview={item.resultPreview}
              error={item.error}
              expanded={item.expanded}
              focused={navActive && item.toolCallId === selectedToolCallId}
              theme={theme}
            />
          ) : (
            <TranscriptRow key={item.id} item={item} theme={theme} />
          ),
        )}
    </Box>
  );
}
