# STATE.md — Feynman Project State

> Status snapshot of the Feynman coding agent project. Updated at the start of each session.
> Companion file: `PLAN.md` (plan + success criteria). See `AGENT.md` for the workflow rules.

**Last updated:** 2026-08-03 (ticket #5 Ctrl+C cancel — implemented + tests green, committed)

---

## 1. What the Project Is

Feynman (`C:\Projects\feynman`) is a **local, terminal-based coding agent** (like Claude Code /
opencode) that the user opens with a single global command — `feynman` — from any project
directory. It explores a repo, reads/writes/edits files, runs shell commands, holds a system
prompt, supports tools + skills, persists chat sessions to SQLite, and resumes them with
`/resume <chat_id>`. It connects to **LM Studio** (local) and **OpenRouter** (cloud) via the
Vercel AI SDK.

## 2. Architecture (implemented)

- **npm workspace monorepo** (`turbo`):
  - `packages/client` (`feynman`) — thin CLI/TUI client, bin `feynman`.
  - `packages/server` (`@feynman/server`) — agent server: session loop, tools, providers, SQLite, bin `feynman-server`.
  - `packages/types` (`@feynman/types`) — shared TS interfaces.
- **Hard client/server split**: client spawns the server as a background subprocess on first use
  (or connects to an already-running one), then talks over local HTTP. Server binds `localhost:3721`.
- **Agent loop** (`server/src/loop/session-loop.ts`): `streamText` from Vercel AI SDK with native
  function-calling tools, `maxSteps` cap (default 25), per-step persistence via `onStepFinish`.
- **Providers** (`server/src/providers/index.ts`): LM Studio via `@ai-sdk/openai-compatible`,
  OpenRouter via `@openrouter/ai-sdk-provider`. Selected by config `provider` value.
- **Tools** (all implemented + registered in `tools/registry.ts`): `read_file`, `write_file`,
  `edit`, `run_terminal`, `list_dir`, `search`.
- **Skills**: markdown `SKILL.md` files auto-discovered from `.agent/skills/<name>/`, manifest
  injected into system prompt, loaded on demand.
- **Persistence**: SQLite at `~/.feynman/sessions.db`; every turn logged; `/resume` does full replay.
- **Config precedence** (highest → lowest): env vars / `.env` → project `.agent/config.json` →
  global `~/.feynman/config.json` → defaults.

## 3. Current Working State

| Area | Status |
|---|---|
| Build | ✅ `npm run build` passes (3 tasks, turbo) |
| Tests | ✅ `npm test` (vitest) — server unit tests present |
| Global `feynman` command | ✅ Works from any directory (npm-linked junction to local packages) |
| Global `feynman-server` | ✅ Works (spawned automatically by client) |
| **OpenRouter connection** | ✅ **VERIFIED** — real end-to-end response from `nvidia/nemotron-3-ultra-550b-a55b:free` |
| **LM Studio connection** | ✅ **CONFIRMED working** (owner verified both provider paths); LM Studio server not running right now |
| Global config | ✅ `~/.feynman/config.json` created with OpenRouter key/provider + LM Studio base URL |
| Session persistence | ✅ Sessions logged to SQLite (`~/.feynman/sessions.db`) |
| v1 scope doc | ✅ `docs/terminal-coding-agent-v1-scope.md` — all v1 success criteria implemented |
| **TUI shell (M1, ticket #1)** | ✅ **Built** — Ink 7 + React 19 full-screen TUI (header/transcript/editor/statusbar), multi-line prompt editor (Enter submit, Shift+Enter newline, ↑/↓ history, Ctrl+R search), slash autocomplete, theme tokens w/ `NO_COLOR`, non-TTY/`--plain` fallback. **Interactive TTY run pending owner verification** |
| Client package | ⚠️ Rebuilt as **ESM** (`"type": "module"`) — Ink 7 is ESM-only; CJS bundling impossible (top-level await). `eventsource-parser`/Ink/React resolve from `node_modules` at runtime |
| **Server event-contract upgrade (ticket #2)** | ✅ **DONE + VERIFIED** — tests green, committed 2026-08-03. See §3a |
| **ToolCards (ticket #3, M2)** | ✅ **DONE + VERIFIED** — tests green, committed 2026-08-03, closed. See §3b |
| **StatusBar live usage (ticket #4, M2)** | ✅ **DONE + VERIFIED** — tests green, committed 2026-08-03, closed. See §3b |
| **Cancel in-flight turns (ticket #5, M2)** | ✅ **IMPLEMENTED + TESTS GREEN** — committed 2026-08-03; interactive TTY run pending owner. See §3c |

### 3a. Ticket #2 — server event-contract upgrade (WIP, 2026-08-02)

**Goal:** additive SSE contract: correlation `id` on `tool-call`/`tool-result`, new `step-start`/
`status`/`usage`/`cancelled` events, `POST /sessions/:id/cancel`, kill hung `run_terminal`. Backwards
compatible with the plain client (verified: `client/src/render.ts` `StreamRenderer` has no `default`
case → ignores new event types; only existing fields are read).

**Implemented (committed):**
- `packages/types/src/index.ts` — `SSEEvent` now: `tool-call`/`tool-result` carry `id` (correlation);
  new `step-start { step }`, `status { status: AgentStatus }`, `usage { usage: TurnUsage }`,
  `cancelled { reason? }`; added `TurnUsage` (prompt/completion/total tokens, optional `cost`,
  `model`, `elapsedMs`), `AgentStatus` union, `CancelTurnResponse`.
- `packages/server/src/tools/registry.ts` — **root-cause fix**: `getAISDKTools()` now returns
  `AISDKTools = Record<string, Tool<any, string> & { execute: (args, options) => PromiseLike<string> }>`
  (required `execute`) instead of `Record<string, CoreTool>`. `CoreTool = Tool<any,any>` has *optional*
  `execute`, which made the AI SDK's `ToolResultUnion` conditional type resolve to `never`, stripping
  `tool-result` from `fullStream`'s union → the 3 pre-existing `session-loop.ts` TS2678/TS2339 errors.
  **This fix verified**: server typecheck now clean for session-loop.
- `packages/server/src/loop/session-loop.ts` — per-session `AbortController` map + `cancelTurn()`;
  `abortSignal` passed to `streamText`; maps `toolCallId → id`; emits `step-start`/`status`
  (connecting→streaming→tool-running→done/cancelled)/`usage` (cumulative tokens + cost + model +
  elapsed)/`cancelled`; AbortError caught → emits `cancelled` + `done`, no error persistence.
- `packages/server/src/tools/run-terminal.ts` — `execute(args, options?)` honors `options.abortSignal`
  → `killProcessTree()` (`taskkill /T /F` on win32, `process.kill(-pid)` POSIX); single-settle guard.
- `packages/server/src/routes/sessions.ts` — `POST /:id/cancel` → `CancelTurnResponse`.
- `packages/server/src/db/sessions.ts` — added `SessionStore.close()` (releases SQLite file lock;
  needed for test cleanup + clean shutdown).
- `packages/server/src/pricing.ts` — `estimateCost(provider, model, usage)`: lmstudio → 0; small
  OpenRouter table (USD/1M tokens); unknown model → `undefined` (cost omitted).

**Verification state (2026-08-03):** ✅ DONE.
- `npm run build` passes; `npm test` → **67 tests green** (server: 22 — allowlist 4, tools 8, db 5,
  session-loop 5; client: 45).
- `session-loop.test.ts` (5 cases): plain-text status/usage/done, tool-call↔result id correlation +
  step-start, cancelTurn → cancelled, cancelTurn false on idle, **run_terminal abort** (kills process,
  settles `[command aborted]` fast, not on the 30s timeout).
- Typecheck: server + client clean **except the 2 pre-existing `search.ts` TS2367 errors** (deferred
  to a separate ticket).

**Test gotcha found (ticket #2):** the AI SDK does **no** abort-checking itself — it relies on the
provider stream to honor `abortSignal`. `simulateReadableStream`'s delay is a plain `setTimeout`
(not abort-aware), so it **cannot** simulate cancel. The cancel test uses a custom abort-aware
`ReadableStream` whose pending `pull` rejects with `AbortError` when the signal fires (mirrors a real
provider mid-stream).

**Known gotcha (ticket #2):** server resolves `@feynman/types` from its **built `dist/`** — after
editing `packages/types/src/index.ts` you must rebuild it (`npx tsup` in `packages/types`, or
`npm run build`) or the server typecheck fails against stale types (TS2305 for `CancelTurnResponse`).
Also: **do not trust scratch-probe tsconfigs** in temp dirs — a `paths`-mapped `ai` probe "passed"
while the real project failed; root cause only reproduces under real module resolution (the earlier
sandbox result was a false positive caused by bypassing transitive `@ai-sdk/*` type deps).

### 3b. Tickets #3–#4 — ToolCards + StatusBar live usage (done, 2026-08-03)

**Goal (M2):** turn the flat text transcript into rich tool cards and a live status bar driven by
the ticket #2 SSE event contract.

**Implemented (committed, tickets closed):**
- `packages/client/src/ui/ToolCard.tsx` — per-tool card: spinner while running, ✓/✗ + elapsed when
  done/failed, one-line collapsed args summary, expand/collapse (focused card shows ▲/▼ hint).
  `edit`/`write_file` cards render a green/red line diff from their args.
- `packages/client/src/ui/diff.ts` — LCS line diff for the card previews (unit-tested).
- `packages/client/src/ui/conversation.ts` — tool items carry `toolCallId`, `status`
  (running/done/error), `startedAt`, `elapsedMs`, `args`, `argsSummary`, `expanded`; reducer
  correlates parallel tool results by `toolCallId`; new actions `tool-call`/`tool-result`/
  `toggle-tool`/`fail-running-tools`.
- `packages/client/src/ui/App.tsx` — Tab (no slash token) enters tool-card nav; ↑/↓ select,
  Enter expand/collapse, Esc/Tab back. For #4: tracks `step-start`/`usage` events, resets at
  turn start, clears `startedAt` on `done`, adds `cancelTurn()`.
- `packages/client/src/ui/StatusBar.tsx` — busy → `step N/max · <live elapsed> · working… · Esc
  cancel`; idle with usage → `<total> tok · $<cost> · <elapsed> · ready`; live elapsed ticks via
  `useAnimation`. Provider/model + session id stay on the left.
- `packages/client/src/ui/PromptEditor.tsx` — Esc cancels an in-flight turn (via new `onCancel`
  prop) when no slash menu is open; input gated by `active` prop.
- `packages/client/src/api.ts` — `cancelTurn(sessionId)` → `POST /sessions/:id/cancel`.
- `packages/types/src/index.ts` — `step-start` now carries `maxSteps` (from server config
  `agent.maxIterations`, default 25) so the bar can show N/max.
- `packages/server/src/loop/session-loop.ts` — emits `maxSteps` on `step-start`.

**Verification state (2026-08-03):** ✅ DONE.
- `npm run build` passes (3 tasks); `npm test` → **91 tests green** (server: 22 — allowlist 4,
  tools 8, db 5, session-loop 5; client: 69). Client typecheck + lint clean; server typecheck
  clean **except the 2 pre-existing `search.ts` TS2367 errors** (deferred to a separate ticket).
- Client tests added: StatusBar busy step/cancel-hint render, settled usage render (tok/$/elapsed).
- Server test: `step-start` asserts `step` + `maxSteps`.

**Gotcha (ticket #4):** same as #2 — `@feynman/types` is consumed from its built `dist/`; after
editing `packages/types/src/index.ts` you must rebuild it (`npx tsup` in `packages/types`) or the
client/server typecheck fails against stale types.

### 3c. Ticket #5 — Cancel in-flight turns (M2, implemented 2026-08-03)

**Goal:** interrupt control in the TUI. Ctrl+C cancels the in-flight turn (via the ticket #2 cancel
endpoint) and the transcript shows a cancelled state; a second Ctrl+C exits the app. A hung
`run_terminal` is killed through the cancel path (server-side abort → `killProcessTree`).

**Implemented (client-side; server cancel path was already in place from ticket #2):**
- `packages/client/src/index.tsx` — `render(<App/>, { exitOnCtrlC: false })` so Ctrl+C reaches the
  app's own handlers instead of Ink exiting immediately.
- `packages/client/src/ui/App.tsx` — global always-on `useInput`: Ctrl+C while busy arms a cancel
  (first press → `cancelTurn()` + system hint "Cancelling turn… press Ctrl+C again to exit", second
  press → `exit()`); Ctrl+C when idle exits directly. `cancelArmedRef` resets when the turn settles.
  `handleEvent` now handles the `cancelled` SSE event → running tool cards marked cancelled + system
  message "Turn cancelled.".
- `packages/client/src/ui/conversation.ts` — `ToolStatus` gains `'cancelled'`; new reducer action
  `cancel-running-tools` marks running tools as cancelled (leaves completed ones done).
- `packages/client/src/ui/ToolCard.tsx` — cancelled cards render `◼` (warning color) + body
  "cancelled".
- `packages/client/src/ui/PromptEditor.tsx` — Ctrl+C is ignored by the editor (no literal "c"
  inserted); handled globally.
- `packages/client/src/ui/StatusBar.tsx` — hint is context-aware: busy → "Ctrl+C cancel", idle →
  "Ctrl+C exit".
- Help text (`/help`) documents the new Ctrl+C behavior.

**Verification state (2026-08-03):** ✅ TESTS GREEN, interactive TTY run pending.
- `npm run build` passes (3 tasks); `npm test` → **93 tests green** (server: 22, client: 71 — +2:
  `cancel-running-tools` reducer test, cancelled ToolCard render test; StatusBar hints asserted).
- Client typecheck + lint clean; server typecheck/lint failures remain the **pre-existing** `search.ts`
  TS2367 ×2 + `sessions.ts` unused `randomUUID`/`any` ×2 (deferred tickets).
- Server-side cancel already proven by ticket #2's `session-loop.test.ts` (cancel → cancelled event;
  `run_terminal` abort kills the process tree).

**Pending:** owner interactive TTY verification — Ctrl+C during a normal turn shows "Turn cancelled."
+ ◼ cards, second Ctrl+C exits; Ctrl+C during a deliberately long `run_terminal` (e.g. `sleep 300`)
  kills it; send a new message after a cancel to confirm a clean fresh turn.

### Verified end-to-end (2026-08-02)

- **Both provider paths confirmed working** by the owner (LM Studio local + OpenRouter cloud).
- Ran `feynman` from `C:\Users\prana\AppData\Local\Temp\opencode\sample-project` (a fresh, unrelated
  project dir).
- Client auto-spawned the server, created a session bound to that cwd, and streamed a real model
  response from OpenRouter.
- **Fresh kill/restart cycle verified** from `C:\Users\prana\AppData\Local\Temp\opencode\fresh-project`
  with the server stopped: client re-spawned the server, bound the session to the new cwd, executed
  `list_dir` + `read_file` tools, and returned a correct answer.
- Proves: **global keyword works on any project dir + server auto-start/restart + OpenRouter connected
  + tool loop runs**.

> Remaining caveat: LM Studio was confirmed working by the owner while the LM Studio app was running.
> The API port observed was `41343` (not the default `1234` in config) — confirm the live port next
> time LM Studio is run, and update `~/.feynman/config.json` if needed.

## 4. Environment Facts (machine-specific)

- OS: Windows (win32), PowerShell 5.1.
- Node `v22.18.0`, npm `11.9.0`. npm packageManager: `npm@10.8.2`.
- Global npm links (junctions into `C:\Projects\feynman\packages\*`):
  - `feynman` → `...\npm\node_modules\feynman` → `packages\client`
  - `feynman-server` → `...\npm\node_modules\@feynman\server` → `packages\server`
  - `@feynman/server@0.1.0` and `feynman@0.1.0` are the linked names.
- Global config: `C:\Users\prana\.feynman\config.json` (provider `openrouter`, model
  `nvidia/nemotron-3-ultra-550b-a55b:free`, OpenRouter API key set, LM Studio base URL
  `http://localhost:1234/v1`).
- Local models installed in LM Studio: `gemma-4-12B-it-QAT` (Q4_0), `NVIDIA-Nemotron-3-Nano-4B`
  (Q4_K_M). LM Studio API was observed on port `41343` (not the default `1234`) — re-confirm the
  live port when LM Studio is next run and update config if needed.
- Repo `.env` (repo-root only, read when cwd = repo): `OPENROUTER_API_KEY`,
  `FEYNMAN_PROVIDER=openrouter`, `FEYNMAN_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free`.
- Feynman server default port: `3721`.

## 5. Known Notes / Gotchas

- `~/.feynman/config.json` now carries the OpenRouter key so the CLI works from **any** cwd (the repo
  `.env` alone only worked when launched from `C:\Projects\feynman`).
- The repo **is** a git repo with a GitHub remote (`Skywalker1080/feynman`, branch `master`) — `git
  log` is the project's decision logbook per the AGENT.md hard rule; tickets #1–#4 closed on GitHub.
- LM Studio API port was observed as `41343`, while the default config points at `1234` — confirm the
  correct port when LM Studio is running and update `~/.feynman/config.json` if needed. LM Studio
  provider path confirmed working by owner.
