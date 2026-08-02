import { Box, Text } from 'ink';
import type { Session } from '@feynman/types';
import type { Theme } from './theme';

export function StatusBar({
  session,
  busy,
  theme,
}: {
  session: Session | null;
  busy: boolean;
  theme: Theme;
}) {
  return (
    <Box justifyContent="space-between" borderStyle="round" borderColor={theme.accent} paddingX={1}>
      <Text color={theme.muted}>
        ⚛ feynman{session ? ` · ${session.provider}/${session.model} · ${session.id}` : ''}
      </Text>
      <Text color={busy ? theme.warning : theme.success}>{busy ? 'working…' : 'ready'} · Ctrl+C exit</Text>
    </Box>
  );
}
