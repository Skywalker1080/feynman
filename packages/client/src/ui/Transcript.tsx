import { useMemo } from 'react';
import { Box, Text, useAnimation } from 'ink';
import type { TranscriptItem } from './conversation';
import type { Theme } from './theme';
import { ToolCard } from './ToolCard';
import { HighlightedText } from './HighlightedText';
import { computeSlice, estimateItemHeight } from './virtualize';

interface TranscriptProps {
  items: TranscriptItem[];
  theme: Theme;
  /** Tool navigation is active — a tool card is focused and keys move the selection. */
  navActive: boolean;
  /** toolCallId of the currently selected tool card, when navActive. */
  selectedToolCallId: string | null;
  /** Terminal width in cells. When provided with `availableRows`, the transcript is virtualized. */
  columns?: number;
  /** Terminal rows available for the transcript. When provided with `columns`, the transcript is virtualized. */
  availableRows?: number;
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

    case 'assistant': {
      const hasCode = item.text.includes('```') || item.text.includes('~~~');
      return (
        <Box marginTop={1} flexDirection={hasCode ? 'column' : undefined}>
          {hasCode ? (
            <HighlightedText text={item.text} theme={theme} />
          ) : (
            <Text color={theme.assistant} wrap="wrap">
              {item.streaming ? '…' : ''}
              {item.text}
            </Text>
          )}
        </Box>
      );
    }

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

export function Transcript({
  items,
  theme,
  navActive,
  selectedToolCallId,
  columns,
  availableRows,
}: TranscriptProps) {
  const anyRunning = items.some((i) => i.kind === 'tool' && i.status === 'running');
  const { frame } = useAnimation({ interval: 80, isActive: anyRunning });

  const slice = useMemo(() => {
    if (columns === undefined || availableRows === undefined) return null;
    const hints = { columns, availableRows, focusedToolCallId: navActive ? selectedToolCallId : null };
    const heights = items.map((item) => estimateItemHeight(item, hints));
    return computeSlice(heights, availableRows);
  }, [items, columns, availableRows, navActive, selectedToolCallId]);

  if (items.length === 0) return null;

  const start = slice?.start ?? 0;
  const overflow = slice?.overflow ?? 0;

  // Newest child sits at the bottom; overflow clips the oldest rows off the top.
  return (
    <Box flexDirection="column" justifyContent="flex-end" flexGrow={1}>
      {overflow > 0 ? (
        <Box marginTop={1}>
          <Text color={theme.muted}>↑ {overflow} older</Text>
        </Box>
      ) : null}
      {items
        .slice(start)
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
              frame={frame}
            />
          ) : (
            <TranscriptRow key={item.id} item={item} theme={theme} />
          ),
        )}
    </Box>
  );
}
