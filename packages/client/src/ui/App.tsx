import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import type { SSEEvent, Session } from '@feynman/types';
import type { ApiClient } from '../api';
import type { ServerManager } from '../server-manager';
import { parseCommand } from './commands';
import { Header } from './Header';
import { Transcript } from './Transcript';
import { PromptEditor } from './PromptEditor';
import { StatusBar } from './StatusBar';
import { createTranscript, transcriptReducer } from './conversation';
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
  '  Tab             Accept a slash-command completion',
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

  const handleEvent = useCallback((ev: SSEEvent) => {
    switch (ev.type) {
      case 'text-delta':
        dispatch({ type: 'assistant-delta', delta: ev.delta });
        break;
      case 'tool-call': {
        const args = JSON.stringify(ev.args);
        dispatch({
          type: 'tool-call',
          toolName: ev.toolName,
          argsSummary: args.length > 80 ? `${args.slice(0, 77)}…` : args,
        });
        break;
      }
      case 'tool-result': {
        const oneLine = ev.result.replace(/\n/g, ' ');
        dispatch({
          type: 'tool-result',
          resultPreview: oneLine.length > 120 ? `${oneLine.slice(0, 117)}…` : oneLine,
        });
        break;
      }
      case 'session-start-disclaimer':
        dispatch({ type: 'system', text: ev.message });
        break;
      case 'error':
        dispatch({ type: 'error', text: ev.message });
        break;
      case 'done':
        dispatch({ type: 'assistant-end' });
        break;
    }
  }, []);

  const startTurn = useCallback(
    async (prompt: string, showUser: boolean) => {
      const id = sessionIdRef.current;
      if (!id || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      if (showUser) dispatch({ type: 'user', text: prompt });
      dispatch({ type: 'assistant-start' });
      try {
        await api.sendMessage(id, prompt, handleEvent);
      } catch (err) {
        dispatch({ type: 'error', text: (err as Error).message });
      } finally {
        dispatch({ type: 'assistant-end' });
        busyRef.current = false;
        setBusy(false);
      }
    },
    [api, handleEvent],
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
                    const calls = JSON.parse(m.tool_call_json) as Array<{ toolName: string }>;
                    for (const c of calls) dispatch({ type: 'tool-call', toolName: c.toolName });
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
      <Transcript items={items} theme={theme} />
      <PromptEditor busy={busy} theme={theme} onSubmit={(text) => void submit(text)} />
      <StatusBar session={session} busy={busy} theme={theme} />
    </Box>
  );
}
