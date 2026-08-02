# STATE.md — Feynman Project State

> Status snapshot of the Feynman coding agent project. Updated at the start of each session.
> Companion file: `PLAN.md` (plan + success criteria). See `AGENT.md` for the workflow rules.

**Last updated:** 2026-08-02 (client rebuilt as ESM Ink TUI — M1 shell done, interactive TTY check pending)

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
- The repo **is** a local git repo (initialized 2026-08-02, no remote) — `git log` is the project's
  decision logbook per the AGENT.md hard rule.
- LM Studio API port was observed as `41343`, while the default config points at `1234` — confirm the
  correct port when LM Studio is running and update `~/.feynman/config.json` if needed. LM Studio
  provider path confirmed working by owner.
