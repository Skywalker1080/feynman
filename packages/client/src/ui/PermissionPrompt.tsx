import { Box, Text, useInput } from 'ink';
import type { PermissionDecision } from '@feynman/types';
import type { Theme } from './theme';

export interface PermissionRequest {
  id: string;
  toolName: string;
  argsSummary: string;
}

export interface PermissionPromptProps {
  request: PermissionRequest;
  theme: Theme;
  /** Called with the user's choice (y / n / a). */
  onAnswer: (decision: PermissionDecision) => void;
  /** Called on Esc / Ctrl+C — cancels the in-flight turn (server rejects pending). */
  onCancel: () => void;
}

/**
 * y/n/always confirmation shown before a gated tool runs. Owns the keyboard
 * while open (PromptEditor and the global Ctrl+C handler are deactivated).
 */
export function PermissionPrompt({ request, theme, onAnswer, onCancel }: PermissionPromptProps) {
  useInput((input, key) => {
    if (key.escape || (key.ctrl && input.toLowerCase() === 'c')) {
      onCancel();
      return;
    }
    const c = input.toLowerCase();
    if (c === 'y') onAnswer('yes');
    else if (c === 'n') onAnswer('no');
    else if (c === 'a') onAnswer('always');
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.warning} paddingX={1}>
      <Text color={theme.warning}>
        ⚠ Allow {request.toolName}: {request.argsSummary}?
      </Text>
      <Text color={theme.muted}>[y]es [n]o [a]lways · Esc cancel</Text>
    </Box>
  );
}
