import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Session } from '@feynman/types';
import type { Theme } from './theme';
import { filterSessions } from './fuzzy';

/** Short relative age for a session's updated_at timestamp. */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export interface SessionPickerProps {
  sessions: Session[];
  onSelect: (session: Session) => void;
  onClose: () => void;
  theme: Theme;
  /** Max rows rendered before showing a "+N more" line. */
  maxRows?: number;
}

export function SessionPicker({
  sessions,
  onSelect,
  onClose,
  theme,
  maxRows = 10,
}: SessionPickerProps) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);

  const filtered = filterSessions(sessions, query);
  const safeIndex = Math.min(index, Math.max(filtered.length - 1, 0));

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input.toLowerCase() === 'c')) {
      onClose();
      return;
    }
    if (key.return) {
      const pick = filtered[safeIndex];
      if (pick) onSelect(pick);
      return;
    }
    if (key.upArrow) {
      setIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow) {
      setIndex((i) => Math.min(filtered.length - 1, i + 1));
      return;
    }
    if (key.backspace) {
      setQuery((q) => q.slice(0, -1));
      setIndex(0);
      return;
    }
    if (input && !key.ctrl) {
      setQuery((q) => q + input);
      setIndex(0);
    }
  });

  const rows = filtered.slice(0, maxRows);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.accent} paddingX={1}>
      <Box>
        <Text color={theme.accent}>resume: </Text>
        <Text color={theme.assistant}>{query}█</Text>
        <Text color={theme.muted}>  ↑/↓ select · Enter resume · Esc close</Text>
      </Box>
      {rows.length === 0 ? (
        <Text color={theme.muted}>no sessions match “{query}”</Text>
      ) : (
        rows.map((s, i) => {
          const selected = i === safeIndex;
          const label = s.preview ?? s.title ?? '(untitled session)';
          return (
            <Box key={s.id}>
              <Text color={selected ? theme.accent : theme.muted}>
                {selected ? '› ' : '  '}
                {label}
              </Text>
              <Text color={theme.muted}>
                {'  '}· {s.cwd} · {formatRelativeTime(s.updated_at)} · {s.model}
              </Text>
            </Box>
          );
        })
      )}
      {filtered.length > maxRows && (
        <Text color={theme.muted}>{filtered.length - maxRows} more…</Text>
      )}
    </Box>
  );
}
