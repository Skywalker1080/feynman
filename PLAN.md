# PLAN.md — Feynman Project Plan

> Living plan for the Feynman coding agent. Progress is ticked `[x]` as items are completed.
> Success criteria for the current phase live at the top. Companion file: `STATE.md`.

**Last updated:** 2026-08-03

---

## Success Criteria (current phase — local packaging + provider connectivity)

The end goal: **use Feynman like other CLI coding harnesses** (Claude Code, opencode) — open a
terminal, `cd` into any project dir, type `feynman`, and the CLI starts there — globally on this
machine, powered by LM Studio **and** OpenRouter.

- [x] **LM Studio + OpenRouter both connect and work** — both provider paths produce a working agent
  response (LM Studio local path and OpenRouter cloud path verified).
- [x] **`feynman` keyword starts the CLI + server in a project dir** — running `feynman` from any
  project directory in a terminal starts the Feynman server and the agent CLI bound to that
  directory.
- [ ] **Fresh install from scratch works** — on a clean machine/dir, `feynman` + `feynman-server`
  install and run with zero manual setup beyond config.

---

## Phase: Local packaging & provider connectivity (in progress)

Goal: make `feynman` a globally invocable CLI on this machine, and prove both providers connect.

- [x] Build all packages (`npm run build` passes).
- [x] Global install of `feynman` + `feynman-server` via npm link (junctions to local packages).
- [x] Create `~/.feynman/config.json` global config (OpenRouter key/provider + LM Studio base URL) so
      the CLI works from any cwd.
- [x] Create sample test project dir (`sample-project`) for CLI testing.
- [x] Verify OpenRouter end-to-end from a non-repo directory (done: response streamed).
- [x] Verify LM Studio path (confirmed by owner — both provider paths work).
- [x] Verify `feynman` starts the server + CLI from a project dir (done: server auto-spawned from
      `sample-project`).
- [x] Re-verify `feynman` after a fresh server kill/restart cycle from an unrelated project dir
      (done: server killed, re-launched from `fresh-project`, tools executed).

## Phase: Repo hygiene & handoff (next)

- [x] `git init` the repo and make an initial commit (repo is now a local git repo with a baseline
      commit; no remote configured).
- [x] AGENT.md hard rule added: commit every change locally as a decision logbook (`git log` = decision
      history), no remote.
- [ ] Confirm `.env` secret handling (OpenRouter key already in `.env` + global config — decide
      whether to keep in-repo or reference env var only).
- [ ] Update README Quick Start to reflect the working global-install flow.

## Phase: Full TUI (next checkpoint / success criterion)

Goal: replace the bare readline REPL with a full-fledged terminal UI like opencode / Claude Code,
built on Ink (React for CLIs). Server stays as-is for M1; the SSE event contract is upgraded
additively for tool/usage/cancel fidelity. Tickets tracked on GitHub (repo `Skywalker1080/feynman`,
issues #1–#9, all labelled `ready-for-agent`):

- [ ] **#1 TUI shell (M1)** — Ink full-screen layout, prompt editor (multi-line, history, Ctrl+R),
      slash autocomplete, streamed text, theme tokens, non-TTY fallback.
      *(built 2026-08-02 — 45 client tests + build + typecheck green; awaiting interactive TTY run)*.
- [x] **#2 Server event-contract upgrade** — correlation ids, `step-start`/`status`/`usage`/`cancelled`
      events, cancel endpoint, kill for `run_terminal`. Backwards compatible.
      *(done + verified 2026-08-03 — 67 tests green incl. run_terminal abort; committed; see STATE.md §3a)*.
- [x] **#3 ToolCards (M2)** — collapsible tool cards w/ spinner/expand/diff; parallel-call correlation.
      *(done 2026-08-03 — committed b933ffc, closed; 67 client tests green)*.
- [x] **#4 StatusBar live usage (M2)** — live tokens/cost, step N/max, elapsed, provider/model.
      *(done 2026-08-03 — committed, closed; busy → step N/max · live elapsed · Esc cancel; idle → tok · $cost · elapsed)*.
- [x] **#5 Cancel (M2)** — Ctrl+C aborts generation; second Ctrl+C exits; kill hung tool runs.
      *(done + owner-verified 2026-08-03 — 93 tests green, committed; closed)*.
- [x] **#6 SessionPicker (M3)** — interactive fuzzy `/resume` list from SQLite.
      *(done 2026-08-03 — 115 tests green, committed, closed; see STATE.md §3d)*.
- [x] **#7 Optional permission gate (M3)** — y/n/always before destructive tools, default off.
      *(done 2026-08-03 — 132 tests green, committed; see STATE.md §3e)*.
- [x] **#8 Plain mode (M3)** — `feynman --plain` + non-TTY auto-fallback for CI/scripts.
      *(done 2026-08-03 — 134 tests green, committed; see STATE.md §3f)*.
- [ ] **#9 TUI polish (M4)** — syntax highlighting, virtualized transcript, parallel-render cleanup.

Ordering: #1 and #2 run first (no blockers, parallelizable); #3–#5 depend on both; #6–#8 on #1;
#9 on #3 + #4.

---

> New work should be added below under the right phase (or a new phase) and confirmed with the owner
> before starting.
