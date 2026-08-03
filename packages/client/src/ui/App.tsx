import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { SSEEvent, Session, TurnUsage } from '@feynman/types';
import type { ApiClient } from '../api';
import type { ServerManager } from '../server-manager';
import { parseCommand } from './commands';
import { Header } from './Header';
import { Transcript } from './Transcript';
import { PromptEditor } from './PromptEditor';
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
  '  /resume <id>    Resume a previous session',
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
  '  Tab             Accept a slash-command completion',
  '  Tab             (no slash token) inspect tool cards',
  '  In card view:   Up/Down select, Enter expand/collapse, Tab back',
  '',
].join('\n');

export function App({ api, serverManager, cwd }: AppProps) {
  const { exit } = useApp();
  const theme = useMemo(() => resolveTheme(), []);
  const [items, dispatch] = useReducer(transcriptReducer, undefined, createTranscript);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting');
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const [navActive, setNavActive] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [turnStep, setTurnStep] = useState(0);
  const [turnMaxSteps, setTurnMaxSteps] = useState(0);
  const [usage, setUsage] = useState<TurnUsage | null>(null);
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(null);

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
      case 'step-start':
        setTurnStep(ev.step);
        setTurnMaxSteps(ev.maxSteps);
        break;
      case 'usage':
        setUsage(ev.usage);
        break;
      case 'error':
        dispatch({ type: 'error', text: ev.message });
        dispatch({ type: 'fail-running-tools', message: ev.message });
        break;
      case 'done':
        dispatch({ type: 'assistant-end' });
        setTurnStartedAt(null);
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
      setTurnStep(0);
      setTurnMaxSteps(0);
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
        setBusy(false);
      }
    },
    [api, handleEvent],
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
          if (!arg) {
            dispatch({ type: 'error', text: 'Usage: /resume <session id>' });
            break;
          }
          try {
            const { session: resumed, messages } = await api.getSession(arg);
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
    [api, cwd, exit, startTurn],
  );

  const submit = useCallback(
    async (text: string) => {
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
    <Box flexDirection="column" height="100%">
      {session && <Header cwd={cwd} session={session} theme={theme} />}
      <Transcript
        items={items}
        theme={theme}
        navActive={navActive}
        selectedToolCallId={selectedTool}
      />
      <PromptEditor
        busy={busy}
        theme={theme}
        active={!navActive}
        onRequestNav={enterNav}
        onSubmit={(text) => void submit(text)}
        onCancel={cancelTurn}
      />
      <StatusBar
        session={session}
        busy={busy}
        navActive={navActive}
        step={turnStep}
        maxSteps={turnMaxSteps}
        usage={usage}
        startedAt={turnStartedAt}
        theme={theme}
      />
    </Box>
  );
}
