import { Box, Text, useAnimation } from 'ink';
import type { Session, TurnUsage } from '@feynman/types';
import type { Theme } from './theme';

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(cost?: number): string | undefined {
  if (cost === undefined) return undefined;
  return `$${cost.toFixed(4)}`;
}

export function StatusBar({
  session,
  busy,
  navActive,
  step,
  maxSteps,
  usage,
  startedAt,
  theme,
}: {
  session: Session | null;
  busy: boolean;
  navActive?: boolean;
  step?: number;
  maxSteps?: number;
  usage?: TurnUsage | null;
  startedAt?: number | null;
  theme: Theme;
}) {
  useAnimation({ interval: 250, isActive: busy });

  const liveElapsed =
    busy && startedAt !== undefined && startedAt !== null
      ? Date.now() - startedAt
      : usage?.elapsedMs;

  const parts: string[] = [];

  if (navActive) {
    parts.push('tool cards · ↑/↓ select, Enter toggle, Tab back');
  } else if (busy) {
    if (step !== undefined && maxSteps !== undefined && maxSteps > 0) {
      parts.push(`step ${step}/${maxSteps}`);
    }
    if (liveElapsed !== undefined) parts.push(formatElapsed(liveElapsed));
    parts.push('working…');
    parts.push('Esc cancel');
  } else {
    if (usage) {
      parts.push(`${usage.totalTokens} tok`);
      const cost = formatCost(usage.cost);
      if (cost) parts.push(cost);
      parts.push(formatElapsed(usage.elapsedMs));
    }
    parts.push('ready');
  }

  parts.push(busy ? 'Ctrl+C cancel' : 'Ctrl+C exit');

  return (
    <Box justifyContent="space-between" borderStyle="round" borderColor={theme.accent} paddingX={1}>
      <Text color={theme.muted}>
        ⚛ feynman{session ? ` · ${session.provider}/${session.model} · ${session.id}` : ''}
      </Text>
      <Text color={busy ? theme.warning : theme.success}>{parts.join(' · ')}</Text>
    </Box>
  );
}
