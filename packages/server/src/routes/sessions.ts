import { Router } from 'express';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import type {
  Config,
  CreateSessionRequest,
  CreateSessionResponse,
  GetSessionResponse,
  ListSessionsResponse,
  SendMessageRequest,
  SSEEvent,
} from '@feynman/types';
import type { SessionStore } from '../db/sessions';
import type { SessionLoop } from '../loop/session-loop';

export function createSessionsRouter(
  sessionStore: SessionStore,
  sessionLoop: SessionLoop,
  config: Config,
) {
  const router = Router();

  // POST /sessions — create a new session
  router.post('/', (req: Request, res: Response) => {
    const body = req.body as CreateSessionRequest;
    const id = randomUUID().slice(0, 8);

    const session = sessionStore.createSession({
      id,
      cwd: body.cwd ?? process.cwd(),
      provider: body.provider ?? config.provider,
      model: body.model ?? config.model,
    });

    const response: CreateSessionResponse = { sessionId: session.id, session };
    res.status(201).json(response);
  });

  // GET /sessions — list all sessions
  router.get('/', (_req: Request, res: Response) => {
    const sessions = sessionStore.listSessions();
    const response: ListSessionsResponse = { sessions };
    res.json(response);
  });

  // GET /sessions/:id — fetch session + full message history (used by /resume)
  router.get('/:id', (req: Request, res: Response) => {
    const session = sessionStore.getSession(req.params['id']!);
    if (!session) {
      res.status(404).json({ error: `Session '${req.params['id']}' not found` });
      return;
    }
    const messages = sessionStore.getMessages(session.id);
    const response: GetSessionResponse = { session, messages };
    res.json(response);
  });

  // POST /sessions/:id/message — send a message, stream the agent's response via SSE
  router.post('/:id/message', async (req: Request, res: Response) => {
    const session = sessionStore.getSession(req.params['id']!);
    if (!session) {
      res.status(404).json({ error: `Session '${req.params['id']}' not found` });
      return;
    }

    const { message } = req.body as SendMessageRequest;
    if (!message?.trim()) {
      res.status(400).json({ error: '`message` is required and must be non-empty' });
      return;
    }

    // Set up SSE headers before any async work
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if proxied
    res.flushHeaders();

    function send(event: SSEEvent): void {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    try {
      await sessionLoop.runTurn(session.id, message.trim(), send);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      send({ type: 'error', message: msg });
    } finally {
      res.end();
    }
  });

  return router;
}
