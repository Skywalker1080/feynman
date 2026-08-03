import { Box, Text, useAnimation } from 'ink';
import type { Session, TurnUsage } from '@feynman/types';
import type { Theme } from './theme';

function formatTokens(usage: TurnUsage | null): string {
  if (!usage) return '0';
  const total = usage.totalTokens;
  if (total >= 1000) return `${(total / 1000).toFixed(1)}k`;
  return String(total);
}

export function Header({
  cwd: _cwd,
  session,
  theme,
  busy,
  usage,
}: {
  cwd: string;
  session: Session;
  theme: Theme;
  busy: boolean;
  usage: TurnUsage | null;
  startedAt: number | null;
  sessionStartedAt: number;
}) {
  useAnimation({ interval: 1000, isActive: busy });

  const promptTokens = usage ? (usage.promptTokens ?? 0) : 0;
  const completionTokens = usage ? (usage.completionTokens ?? 0) : 0;
  const promptStr = promptTokens >= 1000 ? `${(promptTokens / 1000).toFixed(1)}k` : String(promptTokens);
  const completionStr = completionTokens >= 1000 ? `${(completionTokens / 1000).toFixed(1)}k` : String(completionTokens);
  const totalStr = formatTokens(usage);

  const statusColor = busy ? theme.warning : theme.success;
  const statusLabel = busy ? 'Working' : 'Ready';

  return (
    <Box justifyContent="space-between" borderStyle="single" borderColor={theme.border} paddingX={1}>
      {/* Logo */}
      <Text color={theme.accent} bold>
        FEYNMAN
      </Text>

      <Text color={theme.muted}> │ </Text>

      {/* Model */}
      <Text color={theme.muted}>Model: </Text>
      <Text color={theme.accent}>{session.model}</Text>

      <Text color={theme.muted}> │ </Text>

      {/* Session */}
      <Text color={theme.muted}>Session: </Text>
      <Text color={theme.warning}>{session.id}</Text>

      <Text color={theme.muted}> │ </Text>

      {/* Tokens */}
      <Text color={theme.muted}>Tokens: </Text>
      <Text color={theme.accent}>{totalStr}</Text>
      {usage && promptTokens > 0 && (
        <>
          <Text color={theme.muted}> (</Text>
          <Text color={theme.success}>↑ {promptStr}</Text>
          <Text color={theme.muted}> / </Text>
          <Text color={theme.error}>↓ {completionStr}</Text>
          <Text color={theme.muted}>)</Text>
        </>
      )}

      <Text color={theme.muted}> │ </Text>

      {/* Status dot + label */}
      <Text color={statusColor}>● {statusLabel}</Text>
    </Box>
  );
}
