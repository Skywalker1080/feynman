import { useMemo } from 'react';
import { Box, Text, useAnimation } from 'ink';
import type { Theme } from './theme';
import type { ToolStatus } from './conversation';
import { diffLines, type DiffLine } from './diff';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function DiffView({ lines, theme }: { lines: DiffLine[]; theme: Theme }) {
  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <Text
          key={i}
          color={
            line.type === 'add' ? theme.success : line.type === 'remove' ? theme.error : theme.muted
          }
        >
          {line.type === 'add' ? '+ ' : line.type === 'remove' ? '- ' : '  '}
          {line.text === '' ? ' ' : line.text}
        </Text>
      ))}
    </Box>
  );
}

interface ToolCardProps {
  toolName: string;
  args: unknown;
  argsSummary: string;
  status: ToolStatus;
  startedAt: number;
  elapsedMs?: number;
  result?: string;
  resultPreview?: string;
  error?: string;
  expanded: boolean;
  focused: boolean;
  theme: Theme;
}

export function ToolCard(props: ToolCardProps) {
  const {
    toolName,
    args,
    argsSummary,
    status,
    startedAt,
    elapsedMs,
    result,
    resultPreview,
    error,
    expanded,
    focused,
    theme,
  } = props;

  const { frame } = useAnimation({
    interval: 80,
    isActive: status === 'running',
  });

  const liveElapsed = useMemo(() => {
    if (status === 'done' && elapsedMs !== undefined) return elapsedMs;
    if (status === 'error' || status === 'cancelled') return undefined;
    return Date.now() - startedAt;
  }, [status, elapsedMs, startedAt]);

  const icon =
    status === 'running'
      ? SPINNER_FRAMES[frame % SPINNER_FRAMES.length]
      : status === 'done'
        ? '✓'
        : status === 'cancelled'
          ? '◼'
          : '✗';

  const iconColor =
    status === 'running'
      ? theme.warning
      : status === 'done'
        ? theme.success
        : status === 'cancelled'
          ? theme.warning
          : theme.error;

  // For edit / write_file we can render a line diff from the args.
  const diff =
    toolName === 'edit'
      ? diffLines(
          String((args as { old_str?: unknown } | undefined)?.old_str ?? ''),
          String((args as { new_str?: unknown } | undefined)?.new_str ?? ''),
        )
      : toolName === 'write_file'
        ? String((args as { content?: unknown } | undefined)?.content ?? '')
            .split('\n')
            .map((line): DiffLine => ({ type: 'add', text: line }))
        : undefined;

  const toggleHint = focused ? (expanded ? '▲ collapse' : '▼ expand') : '';

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      borderStyle={focused ? 'round' : undefined}
      borderColor={focused ? theme.accent : undefined}
      paddingX={focused ? 1 : 0}
      flexShrink={0}
    >
      <Box>
        <Text color={iconColor}>{icon}</Text>
        <Text color={theme.tool} bold>
          {' '}
          {toolName}
        </Text>
        {liveElapsed !== undefined ? (
          <Text color={theme.muted}> {formatElapsed(liveElapsed)}</Text>
        ) : null}
        <Text color={focused ? theme.warning : theme.muted}> {toggleHint}</Text>
      </Box>

      {expanded ? (
        <Box flexDirection="column" marginTop={1}>
          {diff ? (
            <DiffView lines={diff} theme={theme} />
          ) : result ? (
            <Text wrap="wrap" color={theme.assistant}>
              {result}
            </Text>
          ) : error ? (
            <Text wrap="wrap" color={theme.error}>
              {error}
            </Text>
          ) : null}
        </Box>
      ) : (
        <Box marginTop={0}>
          <Text wrap="wrap" color={theme.muted}>
            {collapsedBody(status, argsSummary, resultPreview, result, error)}
          </Text>
        </Box>
      )}
    </Box>
  );
}

function collapsedBody(
  status: ToolStatus,
  argsSummary: string,
  resultPreview: string | undefined,
  result: string | undefined,
  error: string | undefined,
): string {
  if (status === 'error') return error ?? 'failed';
  if (status === 'cancelled') return 'cancelled';
  const preview = resultPreview ?? (result ? result.replace(/\n/g, ' ') : '');
  const body = argsSummary ? `${argsSummary}${preview ? ` — ${preview}` : ''}` : preview;
  return body || 'running…';
}
