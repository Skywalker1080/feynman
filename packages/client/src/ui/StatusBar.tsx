import { Box, Text } from 'ink';
import type { Theme } from './theme';

interface ShortcutEntry {
  command: string;
  label: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  { command: '/help', label: 'Show all commands' },
  { command: '/new', label: 'New session' },
  { command: '/resume', label: 'Resume session' },
  { command: '/skill', label: 'Load skill' },
  { command: '/exit', label: 'Exit Feynman' },
];

export function StatusBar({ theme }: { theme: Theme }) {
  return (
    <Box borderStyle="single" borderColor={theme.border} paddingX={1}>
      {SHORTCUTS.map((s, i) => (
        <Box key={s.command}>
          {i > 0 && <Text color={theme.muted}> │ </Text>}
          <Text color={theme.accent} bold>
            {s.command}
          </Text>
          <Text color={theme.muted}> {s.label}</Text>
        </Box>
      ))}
    </Box>
  );
}
