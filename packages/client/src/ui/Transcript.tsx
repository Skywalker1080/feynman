import { useMemo } from 'react';
import { Box, Text, useAnimation } from 'ink';
import type { TranscriptItem } from './conversation';
import type { Theme } from './theme';
import { ToolCard } from './ToolCard';
import { Markdown } from './Markdown';
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
  /**
   * How many items from the bottom to hide (scroll up).
   * 0 = anchored to newest; positive = scrolled into history.
   */
  scrollOffset?: number;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function TranscriptRow({ item, theme }: { item: TranscriptItem; theme: Theme }) {
  switch (item.kind) {
    case 'user':
      return (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text color={theme.muted}>{formatTime(item.createdAt)}  </Text>
            <Text color={theme.user} bold>you</Text>
          </Box>
          <Text color={theme.user} wrap="wrap">
            {item.text}
          </Text>
        </Box>
      );

    case 'assistant':
      return (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text color={theme.muted}>{formatTime(item.createdAt)}  </Text>
            <Text color={theme.accent} bold>feynman</Text>
          </Box>
          <Markdown text={item.text} theme={theme} streaming={item.streaming} />
        </Box>
      );

    case 'system':
      if (item.banner) {
        return (
          <Box flexDirection="column" marginTop={1}>
            <Text color={theme.accent} bold wrap="wrap">
              {item.text}
            </Text>
          </Box>
        );
      }
      return (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text color={theme.muted}>{formatTime(item.createdAt)}  </Text>
            <Text color={theme.system} bold>system</Text>
          </Box>
          <Text color={theme.system} wrap="wrap">
            {item.text}
          </Text>
        </Box>
      );

    case 'error':
      return (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text color={theme.muted}>{formatTime(item.createdAt)}  </Text>
            <Text color={theme.error} bold>error</Text>
          </Box>
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
  scrollOffset = 0,
}: TranscriptProps) {
  const anyRunning = items.some((i) => i.kind === 'tool' && i.status === 'running');
  const { frame } = useAnimation({ interval: 80, isActive: anyRunning });

  const slice = useMemo(() => {
    if (columns === undefined || availableRows === undefined) return null;
    const hints = { columns, availableRows, focusedToolCallId: navActive ? selectedToolCallId : null };
    const heights = items.map((item) => estimateItemHeight(item, hints));
    return computeSlice(heights, availableRows, scrollOffset);
  }, [items, columns, availableRows, navActive, selectedToolCallId, scrollOffset]);

  if (items.length === 0) return null;

  const start = slice?.start ?? 0;
  const end = slice?.end ?? items.length;
  const overflow = slice?.overflow ?? 0;
  // Items hidden below the window (newer than what's shown) when scrolled up.
  const hiddenBelow = items.length - end;

  return (
    <Box flexDirection="column" justifyContent="flex-end" flexGrow={1}>
      {/* Older messages clipped above */}
      {overflow > 0 ? (
        <Box marginTop={1}>
          <Text color={theme.muted}>↑ {overflow} older · PageUp to scroll</Text>
        </Box>
      ) : null}

      {items.slice(start, end).map((item) =>
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

      {/* Newer messages clipped below (user scrolled up) */}
      {hiddenBelow > 0 ? (
        <Box marginTop={1}>
          <Text color={theme.warning}>↓ {hiddenBelow} newer · PageDown to scroll</Text>
        </Box>
      ) : null}
    </Box>
  );
}
