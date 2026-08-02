import { Box, Text } from 'ink';
import type { Session } from '@feynman/types';
import type { Theme } from './theme';

export function Header({ cwd, session, theme }: { cwd: string; session: Session; theme: Theme }) {
  return (
    <Box justifyContent="space-between" borderStyle="round" borderColor={theme.accent} paddingX={1}>
      <Text color={theme.accent}>⚛ Feynman v0.1.0</Text>
      <Text color={theme.muted}>{cwd}</Text>
      <Text color={theme.muted}>
        {session.provider} · {session.model}
      </Text>
    </Box>
  );
}
