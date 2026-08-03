/**
 * @feynman/types
 *
 * Shared TypeScript interfaces between the Feynman server and CLI client.
 * No runtime code — purely type-level. Compiled away after tsc.
 */

// ---------------------------------------------------------------------------
// Core domain types
// ---------------------------------------------------------------------------

export type Provider = 'lmstudio' | 'openrouter';

export interface Config {
  /** Active provider for new sessions */
  provider: Provider;
  /** Active model identifier (e.g. "qwen3-30b-a3b" or "anthropic/claude-sonnet-4-5") */
  model: string;
  lmstudio: {
    /** Base URL of the LM Studio local server. Default: http://localhost:1234/v1 */
    baseUrl: string;
  };
  openrouter: {
    /** OpenRouter API key. Prefer OPENROUTER_API_KEY env var over embedding in config file. */
    apiKey: string;
  };
  allowlist: {
    /** Tested + recommended model identifiers for LM Studio */
    lmstudio: string[];
    /** Tested + recommended model slugs for OpenRouter */
    openrouter: string[];
  };
  server: {
    /** TCP port the server binds to. Default: 3721 */
    port: number;
    /** Host the server binds to. Default: "localhost" (localhost-only recommended for v1) */
    host: string;
  };
  skills: {
    /** Directory containing skill subdirectories. Default: ".agent/skills" */
    dir: string;
  };
  agent: {
    /** Maximum number of tool-call steps per turn before the loop is halted. Default: 25 */
    maxIterations: number;
  };
}

export interface Session {
  /** Short random ID used in /resume <id> */
  id: string;
  created_at: string;
  updated_at: string;
  /** Working directory the session was started in */
  cwd: string;
  provider: Provider;
  model: string;
  /** Auto-set from first user message (first 60 chars). Optional. */
  title?: string;
}

export interface Message {
  id: number;
  session_id: string;
  /** Increments once per user turn */
  turn_index: number;
  role: 'user' | 'assistant' | 'tool';
  /** Text content. Null for pure tool_call assistant messages. */
  content?: string | null;
  /** JSON array of AI SDK ToolCall objects (when role === 'assistant' with tool calls) */
  tool_call_json?: string | null;
  /** JSON array of AI SDK ToolResult objects (when role === 'tool') */
  tool_result_json?: string | null;
  created_at: string;
}

export interface Skill {
  /** Skill name from SKILL.md frontmatter */
  name: string;
  /** One-line description from SKILL.md frontmatter */
  description: string;
  /** Absolute path to SKILL.md on disk */
  path: string;
}

// ---------------------------------------------------------------------------
// SSE event envelope — emitted by server, consumed by CLI client
// ---------------------------------------------------------------------------

/**
 * Aggregated token + timing usage for one agent turn.
 * `cost` is a best-effort USD estimate and is omitted when pricing is unknown.
 */
export interface TurnUsage {
  /** Input tokens (prompt) */
  promptTokens: number;
  /** Output tokens (completion) */
  completionTokens: number;
  /** promptTokens + completionTokens */
  totalTokens: number;
  /** Estimated cost in USD (best-effort; omitted when unknown) */
  cost?: number;
  /** Model identifier used for this turn */
  model: string;
  /** Wall-clock duration of the turn in milliseconds */
  elapsedMs: number;
}

/** Coarse lifecycle state of a turn, for StatusBar-style UIs */
export type AgentStatus =
  | 'connecting'
  | 'streaming'
  | 'tool-running'
  | 'done'
  | 'cancelled';

export type SSEEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'tool-call'; id: string; toolName: string; args: unknown }
  | { type: 'tool-result'; id: string; toolName: string; result: string }
  | { type: 'step-start'; step: number }
  | { type: 'status'; status: AgentStatus }
  | { type: 'usage'; usage: TurnUsage }
  | { type: 'cancelled'; reason?: string }
  | { type: 'session-start-disclaimer'; message: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

// ---------------------------------------------------------------------------
// HTTP API request / response shapes
// ---------------------------------------------------------------------------

export interface CreateSessionRequest {
  provider?: Provider;
  model?: string;
  /** Defaults to process.cwd() on the server */
  cwd?: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  session: Session;
}

export interface SendMessageRequest {
  message: string;
}

/** Response for POST /sessions/:id/cancel */
export interface CancelTurnResponse {
  sessionId: string;
  /** Whether an in-flight turn was found and aborted */
  cancelled: boolean;
}

export interface ListSessionsResponse {
  sessions: Session[];
}

export interface GetSessionResponse {
  session: Session;
  messages: Message[];
}

export interface ListSkillsResponse {
  skills: Skill[];
}

export interface GetSkillResponse {
  name: string;
  content: string;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
}
