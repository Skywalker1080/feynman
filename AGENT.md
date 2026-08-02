# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

---

## 0. Session Workflow — READ FIRST (always)

This project keeps its living state and plan in two root files. **Check them at the start of every
session and keep them updated as work progresses.**

- **`STATE.md`** — current state of the project: what's built, what works, what's verified, machine
  environment facts, known gotchas.
- **`PLAN.md`** — the plan: what we are doing next, ordered steps, and the project's **success
  criteria**. Progress is tracked by ticking boxes (`[x]`) as items are done.

Rules:

1. **Start of session:** read `STATE.md` and `PLAN.md` first. Orient on where the project stands and
   what the next planned step is before writing any code.
2. **Update as you go:** when a plan item or success criterion is completed, tick it `[x]` in
   `PLAN.md` immediately.
3. **Keep STATE.md accurate:** update it when the working state changes (new verification, config
   change, environment fact, etc.). Bump the `Last updated` date.
4. **Success criteria live in PLAN.md** — treat them as the definition of done for the current phase.
5. **Ask before expanding the plan:** if new work appears that isn't in `PLAN.md`, propose it there
   and confirm with the owner before adding.

6. **Commit every change to git (HARD RULE):** after every edit/task completes, commit it. The repo
   is the project's **decision logbook**: each commit records a decision we made and the state change
   it produced. The repo is backed by `origin` (https://github.com/Skywalker1080/feynman.git). Rules:
   - Commit **promptly** — right after a unit of work finishes, not in batches at the end.
   - Push to `origin` after committing when the tree is clean and a batch of work is coherent.
   - Commit message format (decision-log style):
     ```
     <area>: <what changed>

     Why: <the decision/context behind this change>
     ```
     Example: `global config: add ~/.feynman/config.json with OpenRouter key`
     `Why: enable the feynman CLI to run with OpenRouter from any project directory.`
   - Use `git status` / `git diff` before committing; stage only intended files; never commit
     secrets. If a secret is already tracked, don't push — flag it to the owner.
   - Every meaningful decision (provider choice, config layout, packaging approach, plan/state
     updates) gets its own commit so `git log` reads like a decision history.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Agent skills

### Issue tracker

Issues live in GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.