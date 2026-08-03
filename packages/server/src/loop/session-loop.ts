import { streamText, type CoreMessage, type LanguageModel, type LanguageModelUsage } from 'ai';
import type { Config, SSEEvent, Message } from '@feynman/types';
import { checkAllowlist } from '../allowlist';
import { composeSystemPrompt } from '../prompt/composer';
import { estimateCost } from '../pricing';
import type { ToolRegistry } from '../tools/registry';
import type { SessionStore } from '../db/sessions';
import type { SkillsDiscovery } from '../skills/discovery';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToolCallRecord = {
  toolCallId: string;
  toolName: string;
  args: unknown;
};

type ToolResultRecord = {
  toolCallId: string;
  toolName: string;
  args: unknown;
  result: unknown;
};

/** Returns true when an error came from aborting the turn via an AbortController */
function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

// ---------------------------------------------------------------------------
// SessionLoop
// ---------------------------------------------------------------------------

/**
 * Core agent loop — runs inside the server process, never the client.
 *
 * Flow per turn:
 *   1. Load message history from DB
 *   2. Check model allowlist (disclaimer on first turn only)
 *   3. Persist user message
 *   4. Compose system prompt
 *   5. Call streamText with tools + maxSteps (SDK handles the full agentic loop)
 *   6. Stream SSE events to caller as they arrive (via fullStream)
 *   7. Persist each step's tool calls / results / text via onStepFinish
 *
 * Cancellation: each in-flight turn registers an AbortController keyed by
 * session id. `cancelTurn` aborts it, which surfaces as an AbortError in the
 * stream loop and emits a `cancelled` SSE event.
 */
export class SessionLoop {
  private readonly activeTurns = new Map<string, AbortController>();

  constructor(
    private readonly config: Config,
    private readonly toolRegistry: ToolRegistry,
    private readonly sessionStore: SessionStore,
    private readonly skillsDiscovery: SkillsDiscovery,
    private readonly getModel: () => LanguageModel,
  ) {}

  /** Abort an in-flight turn. Returns false if no turn is running for that session. */
  cancelTurn(sessionId: string): boolean {
    const controller = this.activeTurns.get(sessionId);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  async runTurn(
    sessionId: string,
    userMessage: string,
    onEvent: (event: SSEEvent) => void,
  ): Promise<void> {
    const session = this.sessionStore.getSession(sessionId);
    if (!session) throw new Error(`Session '${sessionId}' not found`);

    // Determine if this is the first user turn (for disclaimer + auto-title)
    const dbMessages = this.sessionStore.getMessages(sessionId);
    const priorUserTurns = dbMessages.filter((m) => m.role === 'user').length;
    const isFirstTurn = priorUserTurns === 0;

    // Show allowlist disclaimer once at session start
    if (isFirstTurn) {
      const check = checkAllowlist(session.provider, session.model, this.config);
      if (!check.allowed && check.disclaimer) {
        onEvent({ type: 'session-start-disclaimer', message: check.disclaimer });
      }
    }

    // Persist the incoming user message
    const turnIndex = priorUserTurns;
    this.sessionStore.appendMessage({
      session_id: sessionId,
      turn_index: turnIndex,
      role: 'user',
      content: userMessage,
    });

    // Build full conversation history for the model
    const messages: CoreMessage[] = [
      ...this.buildHistory(dbMessages),
      { role: 'user', content: userMessage },
    ];

    // Compose system prompt (repo context + tool list + skills manifest)
    const systemPrompt = composeSystemPrompt(
      session.cwd,
      this.toolRegistry.getManifest(),
      this.skillsDiscovery.getManifest(),
    );

    const controller = new AbortController();
    this.activeTurns.set(sessionId, controller);
    const startedAt = performance.now();

    try {
      onEvent({ type: 'status', status: 'connecting' });

      const result = streamText({
        model: this.getModel(),
        system: systemPrompt,
        messages,
        tools: this.toolRegistry.getAISDKTools(),
        abortSignal: controller.signal,
        // maxSteps drives the full agentic loop — SDK handles tool execution + continuation
        maxSteps: this.config.agent.maxIterations,
        // Persist each completed step to SQLite immediately (no batching)
        onStepFinish: ({ text, toolCalls, toolResults }) => {
          // Persist assistant tool calls (if any)
          if (toolCalls && toolCalls.length > 0) {
            this.sessionStore.appendMessage({
              session_id: sessionId,
              turn_index: turnIndex,
              role: 'assistant',
              tool_call_json: JSON.stringify(toolCalls as ToolCallRecord[]),
            });
          }
          // Persist tool results
          if (toolResults && toolResults.length > 0) {
            this.sessionStore.appendMessage({
              session_id: sessionId,
              turn_index: turnIndex,
              role: 'tool',
              tool_result_json: JSON.stringify(toolResults as ToolResultRecord[]),
            });
          }
          // Persist final text response
          if (text) {
            this.sessionStore.appendMessage({
              session_id: sessionId,
              turn_index: turnIndex,
              role: 'assistant',
              content: text,
            });
          }
        },
      });

      // Stream all events to the caller (SSE / whatever transport)
      let step = 0;
      let usage: LanguageModelUsage | undefined;

      for await (const chunk of result.fullStream) {
        switch (chunk.type) {
          case 'step-start':
            step += 1;
            onEvent({
              type: 'step-start',
              step,
              maxSteps: this.config.agent.maxIterations,
            });
            onEvent({ type: 'status', status: 'streaming' });
            break;

          case 'text-delta':
            onEvent({ type: 'text-delta', delta: chunk.textDelta });
            break;

          case 'tool-call':
            onEvent({
              type: 'tool-call',
              id: chunk.toolCallId,
              toolName: chunk.toolName,
              args: chunk.args,
            });
            onEvent({ type: 'status', status: 'tool-running' });
            break;

          case 'tool-result':
            onEvent({
              type: 'tool-result',
              id: chunk.toolCallId,
              toolName: chunk.toolName,
              // Truncate long results for the SSE payload — full result is in the model context
              result: String(chunk.result).slice(0, 800),
            });
            onEvent({ type: 'status', status: 'streaming' });
            break;

          case 'step-finish':
            usage = chunk.usage;
            break;

          case 'finish':
            usage = chunk.usage;
            break;

          case 'error':
            throw chunk.error instanceof Error ? chunk.error : new Error(String(chunk.error));
        }
      }

      // Auto-title the session on the first turn using the first 60 chars
      if (isFirstTurn) {
        this.sessionStore.updateSessionTitle(sessionId, userMessage.slice(0, 60).trim());
      }
      this.sessionStore.touchSession(sessionId);

      // Emit aggregated usage for the turn
      const promptTokens = usage?.promptTokens ?? 0;
      const completionTokens = usage?.completionTokens ?? 0;
      onEvent({
        type: 'usage',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          cost: estimateCost(session.provider, session.model, {
            promptTokens,
            completionTokens,
          }),
          model: session.model,
          elapsedMs: Math.round(performance.now() - startedAt),
        },
      });

      onEvent({ type: 'status', status: 'done' });
      onEvent({ type: 'done' });
    } catch (err: unknown) {
      if (isAbortError(err)) {
        // Turn was cancelled via cancelTurn — emit cancelled, don't persist as error
        onEvent({ type: 'status', status: 'cancelled' });
        onEvent({ type: 'cancelled' });
        onEvent({ type: 'done' });
        return;
      }

      const message = err instanceof Error ? err.message : String(err);

      // Persist the error so the session record stays coherent
      this.sessionStore.appendMessage({
        session_id: sessionId,
        turn_index: turnIndex,
        role: 'assistant',
        content: `[Agent error: ${message}]`,
      });

      onEvent({ type: 'error', message });
    } finally {
      this.activeTurns.delete(sessionId);
    }
  }

  // ---------------------------------------------------------------------------
  // Private: reconstruct CoreMessage history from DB rows
  // ---------------------------------------------------------------------------

  private buildHistory(dbMessages: Message[]): CoreMessage[] {
    const messages: CoreMessage[] = [];

    for (const msg of dbMessages) {
      if (msg.role === 'user' && msg.content) {
        messages.push({ role: 'user', content: msg.content });
        continue;
      }

      if (msg.role === 'assistant') {
        if (msg.tool_call_json) {
          // Reconstruct assistant tool-call turn
          const toolCalls = JSON.parse(msg.tool_call_json) as ToolCallRecord[];
          messages.push({
            role: 'assistant',
            content: toolCalls.map((tc) => ({
              type: 'tool-call' as const,
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              args: tc.args,
            })),
          });
        } else if (msg.content) {
          messages.push({ role: 'assistant', content: msg.content });
        }
        continue;
      }

      if (msg.role === 'tool' && msg.tool_result_json) {
        const toolResults = JSON.parse(msg.tool_result_json) as ToolResultRecord[];
        messages.push({
          role: 'tool',
          content: toolResults.map((tr) => ({
            type: 'tool-result' as const,
            toolCallId: tr.toolCallId,
            toolName: tr.toolName,
            result: tr.result,
          })),
        });
      }
    }

    return messages;
  }
}
