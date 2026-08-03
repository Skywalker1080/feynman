import { useMemo, useState } from 'react';
import { Box, Text, useInput, type Key } from 'ink';
import {
  createEditor,
  deleteAfter,
  deleteBefore,
  insertChar,
  moveEnd,
  moveHome,
  moveLeft,
  moveRight,
  type EditorState,
} from './editor';
import {
  createHistory,
  historyDown,
  historySearch,
  historyUp,
  pushHistory,
  type History,
} from './history';
import { currentSlashToken, matchCommands } from './commands';
import { CommandMenu } from './CommandMenu';
import { HistorySearch } from './HistorySearch';
import type { Theme } from './theme';

export interface PromptEditorProps {
  busy: boolean;
  theme: Theme;
  onSubmit: (text: string) => void;
  /** When false, the editor stops capturing keyboard input (e.g. transcript nav is active). */
  active?: boolean;
  /** Called when Tab is pressed with no slash-command token (switch to transcript nav). */
  onRequestNav?: () => void;
  /** Called when Esc is pressed while a turn is in flight. */
  onCancel?: () => void;
}

export function PromptEditor({
  busy,
  theme,
  onSubmit,
  active = true,
  onRequestNav,
  onCancel,
}: PromptEditorProps) {
  const [editor, setEditor] = useState<EditorState>(() => createEditor());
  const [history, setHistory] = useState<History>(() => createHistory());
  const [menuIndex, setMenuIndex] = useState(0);
  const [menuDismissed, setMenuDismissed] = useState(false);
  const [search, setSearch] = useState<{ query: string; index: number } | null>(null);

  const token = currentSlashToken(editor.value);
  const matches = useMemo(() => (token ? matchCommands(token) : []), [token]);
  const menuOpen = token !== null && matches.length > 0 && !menuDismissed && search === null;

  const searchResults = useMemo(
    () => (search ? historySearch(history, search.query) : []),
    [history, search],
  );

  const edit = (next: EditorState): void => {
    setEditor(next);
    setMenuDismissed(false);
  };

  const acceptMatch = (): void => {
    const pick = matches[Math.min(menuIndex, matches.length - 1)];
    if (!pick) return;
    setEditor(createEditor(`/${pick.name}`));
    setMenuDismissed(true);
    setMenuIndex(0);
  };

  const doSubmit = (): void => {
    const text = editor.value.trim();
    if (!text || busy) return;
    setEditor(createEditor());
    setMenuDismissed(false);
    setMenuIndex(0);
    setHistory((h) => pushHistory(h, text));
    onSubmit(text);
  };

  const loadHistoryUp = (): void => {
    if (history.entries.length === 0) return;
    const { index, value } = historyUp(history);
    setHistory({ ...history, index });
    setEditor(createEditor(value));
  };

  const loadHistoryDown = (): void => {
    if (history.index === -1) return;
    const { index, value } = historyDown(history);
    setHistory({ ...history, index });
    setEditor(createEditor(value));
  };

  const handleSearchInput = (input: string, key: Key): void => {
    if (!search) return;
    if (key.escape) {
      setSearch(null);
      return;
    }
    if (key.return) {
      const results = historySearch(history, search.query);
      const picked = results[Math.min(search.index, results.length - 1)];
      if (picked) {
        setEditor(createEditor(picked));
        setHistory((h) => pushHistory(h, picked));
      }
      setSearch(null);
      return;
    }
    if (key.upArrow) {
      setSearch((s) => (s ? { ...s, index: Math.max(0, s.index - 1) } : s));
      return;
    }
    if (key.downArrow) {
      setSearch((s) => {
        if (!s) return s;
        const n = historySearch(history, s.query).length;
        return { ...s, index: Math.min(s.index + 1, n - 1) };
      });
      return;
    }
    if (key.backspace) {
      setSearch((s) => (s ? { ...s, query: s.query.slice(0, -1), index: 0 } : s));
      return;
    }
    if (input) {
      setSearch((s) => (s ? { ...s, query: s.query + input, index: 0 } : s));
    }
  };

  useInput(
    (input, key) => {
      if (key.ctrl && input.toLowerCase() === 'c') {
        return; // handled globally by App (cancel turn / exit)
      }
      if (search) {
        handleSearchInput(input, key);
        return;
      }

      if (key.escape) {
        if (menuOpen) setMenuDismissed(true);
        else if (busy && onCancel) onCancel();
        return;
      }

      if (menuOpen && (key.upArrow || key.downArrow)) {
        setMenuIndex((i) => {
          const step = key.upArrow ? -1 : 1;
          return Math.max(0, Math.min(matches.length - 1, i + step));
        });
        return;
      }

      if (key.tab) {
        if (menuOpen && matches.length > 0) acceptMatch();
        else if (token) setMenuDismissed(false);
        else if (onRequestNav) onRequestNav();
        return;
      }

      if (key.return) {
        if (key.shift) {
          edit(insertChar(editor, '\n'));
          return;
        }
        if (menuOpen && matches.length > 0) {
          const exact = matches.some(
            (c) =>
              `/${c.name}` === editor.value ||
              (c.aliases ?? []).some((a) => `/${a}` === editor.value),
          );
          if (exact) doSubmit();
          else acceptMatch();
          return;
        }
        doSubmit();
        return;
      }

      if (key.ctrl && input.toLowerCase() === 'r') {
        setSearch({ query: '', index: 0 });
        return;
      }

      if (key.upArrow) {
        loadHistoryUp();
        return;
      }
      if (key.downArrow) {
        loadHistoryDown();
        return;
      }
      if (key.leftArrow) {
        edit(moveLeft(editor));
        return;
      }
      if (key.rightArrow) {
        edit(moveRight(editor));
        return;
      }
      if (key.home) {
        edit(moveHome(editor));
        return;
      }
      if (key.end) {
        edit(moveEnd(editor));
        return;
      }
      if (key.backspace) {
        edit(deleteBefore(editor));
        return;
      }
      if (key.delete) {
        edit(deleteAfter(editor));
        return;
      }

      if (input) {
        edit(insertChar(editor, input));
      }
    },
    { isActive: active },
  );

  const caret = `${editor.value.slice(0, editor.cursor)}█${editor.value.slice(editor.cursor)}`;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.border} paddingX={1}>
      <Box>
        <Text color={theme.accent}>{busy ? '…' : '❯'} </Text>
        <Text wrap="wrap" color={editor.value === '' ? theme.muted : theme.assistant}>
          {editor.value === '' ? 'Type a message, or /help ' : ''}
          {caret}
        </Text>
      </Box>
      {menuOpen && <CommandMenu matches={matches} index={menuIndex} theme={theme} />}
      {search && (
        <HistorySearch
          query={search.query}
          results={searchResults}
          index={search.index}
          theme={theme}
        />
      )}
    </Box>
  );
}
