# Terminal Coding Agent — v1 Project Scope

**Owner:** Pranav
**Status:** Draft handover doc for build agent
**Scope:** v1 only. All architectural/engineering tradeoffs are decided by the owner — this doc encodes those decisions. Build agent should not silently deviate from decisions marked **[DECIDED]**; items marked **[OPEN]** are intentionally deferred and can be resolved during implementation with owner sign-off.

---

## 1. What we're building

A local, terminal-based coding agent (like Claude Code / opencode) that can explore a repo, read/write/diff files, run shell commands, hold a system prompt, support tools + skills, persist chat sessions, and resume them via `/resume <chat_id>`. Connects to LM Studio (local) and OpenRouter (cloud) as LLM backends.

## 2. v1 Success Criteria

- [ ] Can explore an arbitrary repo (list dirs, read files, grep/search)
- [ ] Has tools: `read_file`, `write_file`, `diff`/`edit`, `run_terminal`, `list_dir`, `search`
- [ ] Has a system prompt (dynamically composed, not just static text)
- [ ] Supports skills (markdown-based, discoverable, injectable into context)
- [ ] Persists every session to SQLite; `/resume <chat_id>` reconstructs full context
- [ ] Connects to LM Studio and OpenRouter via the Vercel AI SDK's provider interface
- [ ] Client and server run as separate processes, communicating over local HTTP/IPC
- [ ] Model allowlist in config; non-allowlisted models trigger a visible disclaimer, not a block
- [ ] Runs a working agent loop end-to-end: prompt → tool calls → tool results → final answer

## 3. Non-Goals for v1 (explicitly out of scope)

- No permission/approval UX for tool calls (see §6.3 — deferred to v2)
- No context compaction/summarization on resume (full replay only, see §6.9)
- No multi-agent orchestration (single agent, single loop)
- No sandboxing/containerization of shell execution
- No RAG/embeddings-based repo indexing — file reads and grep only
- No provider-side tool-schema translation layer beyond OpenAI-compatible format (see §6.4)
- No hard blocking of non-allowlisted models — unlisted models are discouraged via disclaimer, not prevented (see §6.4a)
- No web UI — terminal only

---

## 4. Decisions Locked In

| Decision | Choice |
|---|---|
| Tool calling | **Native function-calling** (OpenAI-compatible tool schema), not prompt-based tags |
| Tool execution safety | **Auto-run everything** in v1 — no confirmation gate before writes/shell. Flagged as a known risk, not a gap to silently fix. |
| Session storage | **SQLite** |
| Runtime | TypeScript / Node.js (continuation of existing local agent work) |
| Agent loop topology | **Hard client/server split, decided now** (opencode-style, not deferred). A server process owns the session loop, tool execution, provider calls, and SQLite persistence. The CLI/TUI is a thin client that talks to the server over local HTTP/IPC — never touches tools, sessions, or the model directly. |
| Provider abstraction | **Vercel AI SDK (`ai` package)** as the `LanguageModel` interface, not a hand-rolled `LLMProvider` abstraction. Model-agnostic by construction — LM Studio and OpenRouter today, any other AI SDK-supported provider later is a config change, not new code |
| Model allowlist | **Restricted by default.** The harness only guarantees good behavior for a curated list of high-tier models, defined in the config file (per provider: LM Studio, OpenRouter). Using a model outside that list is still allowed, but triggers a visible disclaimer (see §6.4a) and routes through the same graceful-exception handling as any other tool-call failure — never a silent fallback or a hard block. |

---

## 5. High-Level Architecture

```
┌─────────────────────────────┐
│      CLI / TUI Client        │
│  - reads user input          │
│  - handles slash commands    │
│  - renders streamed output   │
└──────────────┬────────────────┘
               │  local HTTP / IPC
               │  (requests + streamed responses)
┌──────────────▼────────────────────────────────────────────┐
│                      Agent Server (process)                 │
│                                                                │
│  ┌─────────────────────┐                                    │
│  │  HTTP/IPC interface   │                                   │
│  └──────────┬───────────┘                                    │
│             │                                                │
│  ┌──────────▼───────────┐        ┌────────────────────────┐ │
│  │   SessionLoop         │◄───────┤  Model allowlist check  │ │
│  │  (compose ctx → call   │        │  (config-driven, warns  │ │
│  │   model → branch on    │        │   + graceful exception  │ │
│  │   tool_use → repeat)   │        │   if model not listed)  │ │
│  └──────────┬───────────┘        └────────────────────────┘ │
│             │                                                │
│  ┌──────────▼───────────┐        ┌────────────────────────┐ │
│  │  Provider layer        │        │   Tool executor         │ │
│  │  (Vercel AI SDK:        │        │  (read/write/diff/       │ │
│  │  LM Studio, OpenRouter) │◄──────►│   shell/search)          │ │
│  └────────────────────────┘        └────────────────────────┘ │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │            SQLite session store (every turn)              │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## 6. Core Components

### 6.1 CLI / TUI Client
- Thin client. Reads stdin, sends requests to the server, renders streamed output. Holds no session state, no tool logic, no provider logic of its own — all of that lives server-side.
- Slash commands (v1 minimum): `/resume <chat_id>`, `/new`, `/skill <name>`, `/exit`. These are client-side dispatch that translate into server API calls (e.g. `/resume abc123` → `GET /sessions/abc123` then subscribe to its event stream).
- **[OPEN]** Streaming vs. wait-for-complete rendering — implementation detail, not architecture-blocking.
- **[DECIDED]** Client and server run as separate processes even for local single-machine use in v1 — this is the point of the hard split. The client launches the server as a subprocess if one isn't already running (or connects to an existing one), rather than embedding server logic in-process.

### 6.2 Server Process & Transport
- **[DECIDED]** A local HTTP (or IPC, engineering's call) server owns everything: the session loop, tool execution, provider calls, model allowlist enforcement, and SQLite persistence. The client is replaceable — a future TUI, desktop app, or mobile client could all talk to the same server without touching server code.
- Minimum API surface for v1: create/send a message to a session, stream the response (text + tool events), list sessions, fetch a session's full message history (for `/resume`).
- **[OPEN]** Exact transport (plain HTTP + SSE for streaming, vs. a raw IPC/socket protocol) — implementation detail. HTTP+SSE is the safer default since it's what opencode itself uses and keeps the door open to remote/multi-device use later without protocol changes.
- **[OPEN]** Whether the server binds to localhost only (recommended default for v1, given auto-run tool execution) or is configurable to bind elsewhere — localhost-only should be the v1 default given the known risks in §10.

### 6.3 Agent Loop
- Standard loop, running inside the server's `SessionLoop`: `user input → LLM call (w/ tools) → if tool_use: execute → append tool_result → LLM call again → repeat until final text response`.
- **[DECIDED]** Auto-run all tool calls, no human-in-the-loop confirmation. This is a known v1 risk (agent can write/delete files or run destructive shell commands unsupervised) — flag clearly in README, not hidden.
- **[OPEN]** Max iteration cap per turn to prevent infinite tool-call loops (recommend a sane default like 25, configurable) — implementation detail, not architecture-blocking.

### 6.4 LLM Provider Layer
- **[DECIDED]** Built on the **Vercel AI SDK** (`ai` package) rather than a hand-rolled `LLMProvider` interface. The SDK's `LanguageModel` type is the abstraction — model/provider switching is a config value, not new adapter code.
- Providers for v1:
  - **LM Studio** via `@ai-sdk/openai-compatible`'s `createOpenAICompatible()`, pointed at LM Studio's local OpenAI-compatible server (default `http://localhost:1234/v1`).
  - **OpenRouter** via the official `@openrouter/ai-sdk-provider` package (`createOpenRouter()`).
- Tool schemas defined once with Zod, passed into `streamText()`/`generateText()` — the SDK translates them into each provider's native tool-calling format. This is what fulfills the native function-calling decision without a per-provider translation layer of your own.
- Config-driven provider + model selection (not hardcoded).
- Because the abstraction is the AI SDK's `LanguageModel` interface and not something custom, adding any other AI SDK-supported provider (Anthropic, OpenAI, Groq, Ollama, etc.) later is a config change, not an engineering task — this is what "model agnostic" means concretely for this project.

### 6.4a Model Allowlist & Disclaimer
- **[DECIDED]** The config file defines a curated allowlist of high-tier models per provider (e.g. specific OpenRouter model slugs, specific LM Studio local model names) that the harness is designed and tested against.
- **[DECIDED]** The allowlist is advisory, not enforced. If a session's configured model isn't on the list:
  1. The server surfaces a visible disclaimer to the client at session start (e.g. `"model 'x' is not on the tested allowlist — tool-calling and instruction-following may not work as intended with this harness"`), rendered once, not repeated every turn.
  2. The session proceeds anyway — no hard block.
  3. Any failures that follow (malformed tool calls, missing structured output, etc.) are handled by the **same graceful exception handling** used for any other provider/tool failure (see below) — not a special-cased crash path for "unlisted model."
- Rationale: this directly addresses the real risk flagged in §6.4 (inconsistent tool-calling support across models on the OpenAI-compatible path) without hard-blocking the model-agnostic goal — the user is warned, not stopped.
- **[OPEN]** Exact allowlist contents (which specific models qualify as "high-tier") — this is a config data decision, not an architectural one, and can be updated over time without code changes.
- **[OPEN]** Graceful exception handling shape: at minimum, a malformed/unparseable tool call or provider error should surface as a clear in-session error message (not a silent hang or a full process crash) and should not corrupt the persisted session state. Exact retry/backoff behavior is an implementation detail.

### 6.5 System Prompt Composer
Dynamically assembled every turn (or at session start, then cached) from:
1. Base agent identity/instructions (static)
2. Repo context (cwd, directory structure summary)
3. Tool list (names + descriptions, mirrors the function-calling schema)
4. Skills manifest (names + one-line descriptions of available skills, not full content)

### 6.6 Tool System
See §7 for full spec. Tools are registered in a central registry; each tool exports a JSON schema (for the LLM) and an executor function. Runs server-side only — the client never executes tools directly.

### 6.7 Skills System
- Skills = markdown files in a known directory (e.g. `.agent/skills/<name>/SKILL.md`), same pattern as Claude's skills.
- **[DECIDED — proposed default, confirm with owner]** Auto-discovered at startup: agent scans the skills directory and injects a *manifest* (name + description only) into the system prompt. Full skill content is only loaded into context when the model or user explicitly invokes it (`/skill <name>` or a `load_skill` tool call) — mirrors how Claude's skill-loading avoids bloating context by default.
- Skill file format: YAML frontmatter (name, description) + markdown body (instructions, optionally referencing scripts/resources in the same folder).

### 6.8 Session Persistence (SQLite)
Proposed schema:

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,           -- short id, e.g. nanoid, used in /resume <chat_id>
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  cwd TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  title TEXT                      -- optional, e.g. first user message truncated
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  turn_index INTEGER NOT NULL,
  role TEXT NOT NULL,             -- 'user' | 'assistant' | 'tool'
  content TEXT,                   -- text content, nullable for pure tool_use messages
  tool_call_json TEXT,            -- serialized tool_use block, if any
  tool_result_json TEXT,          -- serialized tool_result, if any
  created_at TEXT NOT NULL
);
```

Lives entirely on the server side. The client never reads or writes SQLite directly — it only ever asks the server's API for session data.

### 6.9 `/resume` Flow
- **[DECIDED]** v1 does full replay: on `/resume <chat_id>`, the server loads all messages for that session in order and reconstructs the exact message array to send back to the provider. No summarization/compaction.
- **[OPEN — known v1 limitation]** Long sessions will eventually hit context window limits. Acceptable for v1; compaction strategy is a v2 problem.

---

## 7. Tool Specifications (v1)

| Tool | Params | Behavior |
|---|---|---|
| `read_file` | `path` | Returns file contents (with line numbers recommended for downstream diff/edit use) |
| `write_file` | `path`, `content` | Overwrites or creates file. Auto-runs, no confirmation. |
| `diff` / `edit` | `path`, `old_str`, `new_str` | Targeted find-and-replace edit; should fail loudly if `old_str` isn't unique in the file (avoid silent wrong-location edits) |
| `run_terminal` | `command`, `cwd?` | Executes shell command, captures stdout/stderr/exit code, returns to model. Auto-runs, no sandboxing in v1. |
| `list_dir` | `path` | Lists directory contents (files + subdirs), reasonable depth limit |
| `search` / `grep` | `pattern`, `path?` | Text search across repo (ripgrep-backed recommended) |

All tools registered with an OpenAI-compatible JSON schema for native function-calling.

---

## 8. Config

- Config file (e.g. `.agent/config.json` or `~/.agentrc`) should hold: default provider, default model, LM Studio base URL, OpenRouter API key (env var reference, not plaintext), skills directory path, max loop iterations, **model allowlist** (per provider, list of tested/supported model identifiers — see §6.4a), server bind address/port.
- **[OPEN]** Exact config format/location — implementation detail.

---

## 9. Build Order (suggested, not prescriptive)

1. Server skeleton (HTTP/IPC interface, no logic yet) + minimal client that can connect and send one message
2. Vercel AI SDK provider setup + LM Studio via `@ai-sdk/openai-compatible` (fastest local feedback loop)
3. Tool registry + `read_file`/`write_file`/`list_dir` (no shell yet — lowest risk), running server-side
4. Basic agent loop wired to provider + these 3 tools, no persistence yet
5. Add `run_terminal`, `search`, `diff`/`edit`
6. SQLite session persistence (log every turn as it happens)
7. `/resume` command (client requests session history from server)
8. System prompt composer (repo context injection)
9. Skills system (discovery + manifest injection + `/skill` load)
10. Model allowlist config + disclaimer surfacing on session start
11. OpenRouter via `@openrouter/ai-sdk-provider`
12. Polish: config file, error handling, CLI ergonomics

---

## 10. Known v1 Risks (explicit, not hidden)

- **No tool confirmation gate** — the agent can modify/delete files and run arbitrary shell commands without asking. Owner has explicitly chosen this tradeoff for v1 speed.
- **No context compaction** — long `/resume`d sessions can exceed context window; will surface as a provider error, not handled gracefully in v1.
- **No sandboxing** — `run_terminal` executes with full user permissions on the host machine.
- **Server binds to a local port** — even at localhost-only, this is a new attack surface that a monolithic CLI wouldn't have. Acceptable for v1 given it's a dev tool on the owner's own machine, but worth remembering if the server's bind address ever becomes configurable beyond localhost.
- **Model allowlist is advisory, not enforced** — a user (including future-you, six months from now, forgetting the config) can run any model and get degraded tool-calling behavior with only a one-time disclaimer as a safeguard.
