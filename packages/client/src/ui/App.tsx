import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import type { PermissionDecision, SSEEvent, Session, TurnUsage } from '@feynman/types';
import type { ApiClient } from '../api';
import type { ServerManager } from '../server-manager';
import { parseCommand } from './commands';
import { Header } from './Header';
import { Transcript } from './Transcript';
import { PromptEditor } from './PromptEditor';
import { SessionPicker } from './SessionPicker';
import { PermissionPrompt, type PermissionRequest } from './PermissionPrompt';
import { StatusBar } from './StatusBar';
import { createTranscript, transcriptReducer } from './conversation';
import { summarizeArgs } from './tool';
import { resolveTheme } from './theme';

export interface AppProps {
  api: ApiClient;
  serverManager: ServerManager;
  cwd: string;
}

const HELP_TEXT = [
  'Commands:',
  '  /new            Start a new session in this directory',
  '  /resume         Open the session picker to resume a previous session',
  '                  (/resume <id> resumes by id directly)',
  '  /skill <name>   Load a skill into the session',
  '  /help           Show this help',
  '  /exit           Exit the CLI',
  '',
  'Keys:',
  '  Enter           Send the message',
  '  Shift+Enter     New line',
  '  Up / Down       Walk command history',
  '  Ctrl+R          Reverse-search history',
  '  Esc             Cancel an in-flight turn',
  '  Ctrl+C          Cancel an in-flight turn; second press exits',
  '  Tab             Accept a slash-command completion',
  '  Tab             (no slash token) inspect tool cards',
  '  In card view:   Up/Down select, Enter expand/collapse, Tab back',
  '',
].join('\n');

export function App({ api, serverManager, cwd }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const theme = useMemo(() => resolveTheme(), []);
  /** Rows reserved for header / status bar / prompt editor (+ safety margin). */
  const transcriptColumns = stdout.columns;
  // header (3) + prompt editor (4) + status bar (3) = 10 rows reserved
  const transcriptRows =
    stdout.rows === undefined ? undefined : Math.max(1, stdout.rows - 10);
  const [items, dispatch] = useReducer(transcriptReducer, undefined, createTranscript);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting');
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  /** Set after the first Ctrl+C while busy — a second press then exits. */
  const cancelArmedRef = useRef(false);
  const [navActive, setNavActive] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  /** Non-null while the /resume session picker is open. */
  const [pickerSessions, setPickerSessions] = useState<Session[] | null>(null);
  /** Gated tool calls awaiting a y/n/always answer. Show the first; pop on answer. */
  const [pendingPermissions, setPendingPermissions] = useState<PermissionRequest[]>([]);
  const [usage, setUsage] = useState<TurnUsage | null>(null);
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(null);
  const sessionStartedAtRef = useRef<number>(Date.now());
  /** How many items from the bottom are hidden (user scrolled up into history). */
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await serverManager.ensureServerRunning();
        if (cancelled) return;
        const created = await api.createSession(cwd);
        if (cancelled) return;
        sessionIdRef.current = created.sessionId;
        setSession(created.session);
        setStatus('ready');
        dispatch({
          type: 'system',
          banner: true,
          text: [
            '',
            '  ███████╗███████╗██╗   ██╗███╗   ██╗███╗   ███╗ █████╗ ███╗   ██╗',
            '  ██╔════╝██╔════╝╚██╗ ██╔╝████╗  ██║████╗ ████║██╔══██╗████╗  ██║',
            '  █████╗  █████╗   ╚████╔╝ ██╔██╗ ██║██╔████╔██║███████║██╔██╗ ██║',
            '  ██╔══╝  ██╔══╝    ╚██╔╝  ██║╚██╗██║██║╚██╔╝██║██╔══██║██║╚██╗██║',
            '  ██║     ███████╗   ██║   ██║ ╚████║██║ ╚═╝ ██║██║  ██║██║ ╚████║',
            '  ╚═╝     ╚══════╝   ╚═╝   ╚═╝  ╚═══╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝',
            '',
            '  Your terminal coding agent is ready. Type /help to get started.',
            '',
          ].join('\n'),
        });
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, serverManager, cwd]);

  const toolItems = useMemo(
    () =>
      items.filter((i) => i.kind === 'tool') as Extract<(typeof items)[number], { kind: 'tool' }>[],
    [items],
  );

  const toolCallIds = useMemo(() => toolItems.map((t) => t.toolCallId), [toolItems]);

  const handleEvent = useCallback((ev: SSEEvent) => {
    switch (ev.type) {
      case 'text-delta':
        dispatch({ type: 'assistant-delta', delta: ev.delta });
        break;
      case 'tool-call':
        dispatch({
          type: 'tool-call',
          toolCallId: ev.id,
          toolName: ev.toolName,
          args: ev.args,
          argsSummary: summarizeArgs(ev.toolName, ev.args),
          startedAt: Date.now(),
        });
        break;
      case 'tool-result':
        dispatch({ type: 'tool-result', toolCallId: ev.id, result: ev.result });
        break;
      case 'session-start-disclaimer':
        dispatch({ type: 'system', text: ev.message });
        break;
      case 'usage':
        setUsage(ev.usage);
        break;
      case 'error':
        dispatch({ type: 'error', text: ev.message });
        dispatch({ type: 'fail-running-tools', message: ev.message });
        break;
      case 'cancelled':
        dispatch({ type: 'cancel-running-tools' });
        dispatch({ type: 'system', text: 'Turn cancelled.' });
        break;
      case 'permission-request':
        setPendingPermissions((prev) => [
          ...prev,
          {
            id: ev.id,
            toolName: ev.toolName,
            argsSummary: summarizeArgs(ev.toolName, ev.args),
          },
        ]);
        break;
      case 'done':
        dispatch({ type: 'assistant-end' });
        setTurnStartedAt(null);
        if (ev.finishReason === 'length') {
          dispatch({
            type: 'system',
            text: `Reached max steps (${ev.maxSteps ?? '?'}). The turn stopped early — ask to continue.`,
          });
        } else if (ev.emptyAfterTools) {
          dispatch({
            type: 'system',
            text: 'Model finished without a final response after the tool calls. Ask it to continue and summarize.',
          });
        }
        break;
    }
  }, []);

  const startTurn = useCallback(
    async (prompt: string, showUser: boolean) => {
      const id = sessionIdRef.current;
      if (!id || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setNavActive(false);
      setSelectedTool(null);
      setUsage(null);
      setTurnStartedAt(Date.now());
      if (showUser) dispatch({ type: 'user', text: prompt });
      dispatch({ type: 'assistant-start' });
      try {
        await api.sendMessage(id, prompt, handleEvent);
      } catch (err) {
        dispatch({ type: 'error', text: (err as Error).message });
        dispatch({ type: 'fail-running-tools', message: (err as Error).message });
      } finally {
        dispatch({ type: 'assistant-end' });
        busyRef.current = false;
        cancelArmedRef.current = false;
        setPendingPermissions([]);
        setBusy(false);
      }
    },
    [api, handleEvent],
  );

  const answerPermission = useCallback(
    (decision: PermissionDecision) => {
      const current = pendingPermissions[0];
      if (!current) return;
      const id = sessionIdRef.current;
      if (id) {
        void api.respondPermission(id, current.id, decision).catch((err) => {
          dispatch({ type: 'error', text: (err as Error).message });
        });
      }
      setPendingPermissions((prev) => prev.slice(1));
    },
    [api, pendingPermissions],
  );

  const enterNav = useCallback(() => {
    if (toolCallIds.length === 0) return;
    setNavActive(true);
    setSelectedTool((current) => current ?? toolCallIds[toolCallIds.length - 1] ?? null);
  }, [toolCallIds]);

  const exitNav = useCallback(() => {
    setNavActive(false);
    setSelectedTool(null);
  }, []);

  useInput(
    (input, key) => {
      if (key.tab || key.escape) {
        exitNav();
        return;
      }
      const currentIndex = toolCallIds.indexOf(selectedTool ?? '');
      if (key.downArrow) {
        const next = toolCallIds[Math.min(currentIndex + 1, toolCallIds.length - 1)];
        if (next) setSelectedTool(next);
        return;
      }
      if (key.upArrow) {
        const prev = toolCallIds[Math.max(currentIndex - 1, 0)];
        if (prev) setSelectedTool(prev);
        return;
      }
      if (key.return) {
        if (selectedTool) dispatch({ type: 'toggle-tool', toolCallId: selectedTool });
        return;
      }
      if (input) {
        exitNav();
      }
    },
    { isActive: navActive },
  );

  const resumeSession = useCallback(
    async (id: string) => {
      try {
        const { session: resumed, messages } = await api.getSession(id);
        sessionIdRef.current = resumed.id;
        setSession(resumed);
        dispatch({ type: 'reset' });
        for (const m of messages) {
          if (m.role === 'user' && m.content) {
            dispatch({ type: 'user', text: m.content });
          } else if (m.role === 'assistant') {
            if (m.content) {
              dispatch({ type: 'assistant-start' });
              dispatch({ type: 'assistant-delta', delta: m.content });
              dispatch({ type: 'assistant-end' });
            }
            if (m.tool_call_json) {
              try {
                const calls = JSON.parse(m.tool_call_json) as Array<{
                  toolCallId: string;
                  toolName: string;
                  args?: unknown;
                }>;
                for (const c of calls) {
                  dispatch({
                    type: 'tool-call',
                    toolCallId: c.toolCallId,
                    toolName: c.toolName,
                    args: c.args ?? {},
                    argsSummary: summarizeArgs(c.toolName, c.args),
                    startedAt: Date.now(),
                  });
                  dispatch({
                    type: 'tool-result',
                    toolCallId: c.toolCallId,
                    result: '',
                  });
                }
              } catch {
                // ignore malformed tool call json
              }
            }
          }
        }
      } catch (err) {
        dispatch({ type: 'error', text: (err as Error).message });
      }
    },
    [api],
  );

  const runCommand = useCallback(
    async (name: string, arg?: string) => {
      switch (name) {
        case 'exit':
          exit();
          break;
        case 'help':
          dispatch({ type: 'system', text: HELP_TEXT });
          break;
        case 'new': {
          const created = await api.createSession(cwd);
          sessionIdRef.current = created.sessionId;
          setSession(created.session);
          dispatch({ type: 'reset' });
          break;
        }
        case 'resume': {
          if (arg) {
            await resumeSession(arg);
            break;
          }
          try {
            const { sessions } = await api.listSessions();
            if (sessions.length === 0) {
              dispatch({ type: 'error', text: 'No past sessions to resume.' });
            } else {
              setPickerSessions(sessions);
            }
          } catch (err) {
            dispatch({ type: 'error', text: (err as Error).message });
          }
          break;
        }
        case 'skill': {
          if (!arg) {
            dispatch({ type: 'error', text: 'Usage: /skill <name>' });
            break;
          }
          try {
            const { content } = await api.getSkill(arg);
            dispatch({ type: 'system', text: `Loading skill '${arg}' into session…` });
            await startTurn(`[SKILL INSTRUCTION LOADED: ${arg}]\n${content}`, false);
          } catch (err) {
            dispatch({ type: 'error', text: (err as Error).message });
          }
          break;
        }
        default:
          dispatch({ type: 'error', text: `Unknown command: /${name}` });
      }
    },
    [api, cwd, exit, resumeSession, startTurn],
  );

  const submit = useCallback(
    async (text: string) => {
      // Snap to bottom whenever the user sends a message.
      setScrollOffset(0);
      const parsed = parseCommand(text);
      if (parsed) {
        await runCommand(parsed.name, parsed.arg);
        return;
      }
      await startTurn(text, true);
    },
    [runCommand, startTurn],
  );

  const cancelTurn = useCallback(() => {
    const id = sessionIdRef.current;
    if (!id || !busyRef.current) return;
    void api.cancelTurn(id).catch((err) => {
      dispatch({ type: 'error', text: `Failed to cancel turn: ${(err as Error).message}` });
    });
  }, [api]);

  // PageUp / PageDown scroll the transcript. Active whenever the prompt is
  // accepting input (not in nav mode, picker or permission overlay).
  const scrollStep = Math.max(3, Math.floor((transcriptRows ?? 10) / 2));
  useInput(
    (_input, key) => {
      if (key.pageUp) {
        setScrollOffset((prev) => Math.min(prev + scrollStep, Math.max(0, items.length - 1)));
        return;
      }
      if (key.pageDown) {
        setScrollOffset((prev) => Math.max(0, prev - scrollStep));
        return;
      }
    },
    { isActive: !navActive && pickerSessions === null && pendingPermissions.length === 0 },
  );

  // Global Ctrl+C handling — first press cancels an in-flight turn, second
  // press exits; with no turn in flight a single press exits. Deactivated while
  // the session picker or a permission prompt is open so those own the keys.
  useInput(
    (input, key) => {
      if (!(key.ctrl && input.toLowerCase() === 'c')) return;
      if (busyRef.current) {
        if (cancelArmedRef.current) {
          exit();
        } else {
          cancelArmedRef.current = true;
          cancelTurn();
          dispatch({ type: 'system', text: 'Cancelling turn… press Ctrl+C again to exit' });
        }
      } else {
        exit();
      }
    },
    { isActive: pickerSessions === null && pendingPermissions.length === 0 },
  );

  if (status === 'connecting') {
    return (
      <Box>
        <Text color={theme.muted}>⚛ Starting Feynman server…</Text>
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box>
        <Text color={theme.error}>✖ {error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={stdout.rows ?? 24}>
      {session && (
        <Header
          cwd={cwd}
          session={session}
          theme={theme}
          busy={busy}
          usage={usage}
          startedAt={turnStartedAt}
          sessionStartedAt={sessionStartedAtRef.current}
        />
      )}
      {/* Transcript grows to fill all space between header and prompt */}
      <Box flexGrow={1} flexDirection="column" justifyContent="flex-end">
        <Transcript
          items={items}
          theme={theme}
          navActive={navActive}
          selectedToolCallId={selectedTool}
          columns={transcriptColumns}
          availableRows={transcriptRows}
          scrollOffset={scrollOffset}
        />
      </Box>
      <PromptEditor
        busy={busy}
        theme={theme}
        active={!navActive && pickerSessions === null && pendingPermissions.length === 0}
        onRequestNav={enterNav}
        onSubmit={(text) => void submit(text)}
        onCancel={cancelTurn}
      />
      {pickerSessions !== null && (
        <SessionPicker
          sessions={pickerSessions}
          theme={theme}
          onSelect={(s) => {
            setPickerSessions(null);
            void resumeSession(s.id);
          }}
          onClose={() => setPickerSessions(null)}
        />
      )}
      {pendingPermissions.length > 0 && (
        <PermissionPrompt
          request={pendingPermissions[0]!}
          theme={theme}
          onAnswer={answerPermission}
          onCancel={cancelTurn}
        />
      )}
      <StatusBar theme={theme} />
    </Box>
  );
}
