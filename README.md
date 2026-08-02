# Feynman ⚛️

> Local, terminal-based coding agent powered by LM Studio & OpenRouter via the Vercel AI SDK.

[![npm version](https://img.shields.io/npm/v/feynman.svg)](https://www.npmjs.com/package/feynman)
[![license](https://img.shields.io/npm/l/feynman.svg)](./LICENSE)

Feynman is a lightweight, high-performance terminal agent designed for local-first repo exploration, file editing, shell execution, and skills. It features a hard client/server separation, SQLite session persistence, and native tool-calling.

---

## ⚡ Quick Start

### Installation

```bash
npm install -g feynman @feynman/server
```

Or run directly with `npx`:

```bash
npx feynman
```

### Running

1. Make sure **LM Studio** is running locally (default: `http://localhost:1234/v1`) or set your `OPENROUTER_API_KEY`.
2. Run `feynman` inside any project directory:
   ```bash
   feynman
   ```
3. Type your prompt, e.g.:
   - *"Explore this repo and summarize the architecture"*
   - *"Find all TODO comments across the codebase"*
   - *"Add a unit test for user authentication"*

---

## 🏗️ Architecture & Packages

Feynman is built as an npm workspace monorepo:

| Package | Description | Binary |
|---|---|---|
| [`feynman`](./packages/client) | Thin CLI / TUI client process | `feynman` |
| [`@feynman/server`](./packages/server) | Background agent server (session loop, SQLite, tools) | `feynman-server` |
| [`@feynman/types`](./packages/types) | Shared TypeScript interfaces | — |

The client and server run as separate processes:
- **Server**: Manages LLM connections, tool execution, system prompt composition, and SQLite persistence (`~/.feynman/sessions.db`).
- **Client**: Handles user terminal interaction, renders streamed output, and dispatches slash commands.

---

## 🎮 Slash Commands

Inside the Feynman CLI:

- `/resume <chat_id>` — Resume a previous chat session by ID
- `/new` — Start a new session in the current directory
- `/skill <name>` — Load instructions from a skill (`.agent/skills/<name>/SKILL.md`)
- `/exit` — Exit the CLI

---

## ⚙️ Configuration

Feynman loads configuration from:
1. `~/.feynman/config.json` (Global user config)
2. `.agent/config.json` (Project-local config)
3. Environment variables (`OPENROUTER_API_KEY`, `LMSTUDIO_BASE_URL`, `FEYNMAN_MODEL`, `FEYNMAN_PROVIDER`)

### Example `~/.feynman/config.json`

```json
{
  "provider": "lmstudio",
  "model": "qwen3-30b-a3b",
  "lmstudio": {
    "baseUrl": "http://localhost:1234/v1"
  },
  "openrouter": {
    "apiKey": ""
  },
  "agent": {
    "maxIterations": 25
  }
}
```

---

## 🛠️ Tools

Feynman includes native function-calling tools:

- `read_file` — Reads file contents with line numbers
- `write_file` — Creates or overwrites files (auto-creates directories)
- `edit` — Performs surgical find-and-replace (fails if not unique)
- `run_terminal` — Executes shell commands and captures stdout/stderr/exit code
- `list_dir` — Lists directory trees up to specified depth
- `search` — Searches text using `ripgrep` (or system `grep` fallback)

---

## ⚠️ Known v1 Design Tradeoffs

- **No Tool Confirmation Gate**: Tools auto-execute without human confirmation in v1.
- **No Sandboxing**: Shell commands run directly with host user permissions.
- **Advisory Model Allowlist**: Unlisted models trigger a single warning but are allowed.

---

## 📜 License

[MIT](./LICENSE) © Pranav
