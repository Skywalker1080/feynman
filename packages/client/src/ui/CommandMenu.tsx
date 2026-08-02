import { Box, Text } from 'ink';
import type { SlashCommand } from './commands';
import type { Theme } from './theme';

export function CommandMenu({
  matches,
  index,
  theme,
}: {
  matches: SlashCommand[];
  index: number;
  theme: Theme;
}) {
  return (
    <Box flexDirection="column" marginTop={1}>
      {matches.map((m, i) => (
        <Text key={m.name} color={i === index ? theme.accent : theme.muted}>
          {i === index ? '› ' : '  '}
          {`/${m.name}${m.argHint ? ` ${m.argHint}` : ''}`} — {m.description}
        </Text>
      ))}
    </Box>
  );
}
