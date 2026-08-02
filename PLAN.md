# PLAN.md — Feynman Project Plan

> Living plan for the Feynman coding agent. Progress is ticked `[x]` as items are completed.
> Success criteria for the current phase live at the top. Companion file: `STATE.md`.

**Last updated:** 2026-08-02

---

## Success Criteria (current phase — local packaging + provider connectivity)

The end goal: **use Feynman like other CLI coding harnesses** (Claude Code, opencode) — open a
terminal, `cd` into any project dir, type `feynman`, and the CLI starts there — globally on this
machine, powered by LM Studio **and** OpenRouter.

- [x] **LM Studio + OpenRouter both connect and work** — both provider paths produce a working agent
  response (LM Studio local path and OpenRouter cloud path verified).
- [ ] **`feynman` keyword starts the CLI + server in a project dir** — running `feynman` from any
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
- [ ] Re-verify `feynman` works after a fresh server kill/restart cycle from an unrelated project dir.

## Phase: Repo hygiene & handoff (next)

- [ ] `git init` the repo and make an initial commit (repo is not a git repo yet).
- [ ] Confirm `.env` secret handling (OpenRouter key already in `.env` + global config — decide
      whether to keep in-repo or reference env var only).
- [ ] Update README Quick Start to reflect the working global-install flow.

---

> New work should be added below under the right phase (or a new phase) and confirmed with the owner
> before starting.
