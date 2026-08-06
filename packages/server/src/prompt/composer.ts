import fs from 'fs';
import type { Skill } from '@feynman/types';

interface ToolInfo {
  name: string;
  description: string;
}

/**
 * Compose the system prompt from 4 parts (assembled at session creation):
 *  1. Base agent identity + instructions (static)
 *  2. Repo context (cwd + top-level directory listing)
 *  3. Tool manifest (names + one-line descriptions)
 *  4. Skills manifest (names + descriptions, NOT full content)
 */
export function composeSystemPrompt(
  cwd: string,
  tools: ToolInfo[],
  skills: Skill[],
): string {
  const parts: string[] = [
    BASE_IDENTITY,
    '',
    '## Working Directory',
    `\`${cwd}\``,
    '',
    '## Repository Overview',
    getRepoContext(cwd),
    '',
    '## Available Tools',
    formatTools(tools),
  ];

  if (skills.length > 0) {
    parts.push('', '## Available Skills', formatSkills(skills));
  }

  parts.push(
    '',
    '## Operating Guidelines',
    '- **Always read before writing**: use `read_file` before `edit` or `write_file`',
    '- **Prefer targeted edits**: use `edit` (find-and-replace) over rewriting entire files',
    '- **Verify changes**: after editing, confirm with `read_file`',
    '- **Report errors clearly**: if a tool call fails, explain why and suggest a fix',
    '- **Always end with a summary**: after your final tool call, respond with a clear explanation of what you did and what you found. Never end a turn on a tool call alone.',
    '- **Auto-run notice**: all tool calls execute immediately with no confirmation gate',
  );

  return parts.join('\n');
}

function getRepoContext(cwd: string): string {
  try {
    const entries = fs.readdirSync(cwd, { withFileTypes: true });
    const lines = entries
      .slice(0, 40)
      .map((e) => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`);
    return lines.join('\n') || '(empty directory)';
  } catch {
    return '(could not read directory)';
  }
}

function formatTools(tools: ToolInfo[]): string {
  return tools.map((t) => `- **\`${t.name}\`**: ${t.description}`).join('\n');
}

function formatSkills(skills: Skill[]): string {
  const list = skills.map((s) => `- **${s.name}**: ${s.description}`).join('\n');
  return (
    list +
    '\n\nTo load a skill\'s full instructions into context, use `/skill <name>` in the CLI.'
  );
}

// ---------------------------------------------------------------------------
// Static base identity prompt
// ---------------------------------------------------------------------------

const BASE_IDENTITY = `\
You are **Feynman**, a local terminal coding agent. You help developers explore, understand, and modify codebases by directly reading and writing files, running shell commands, and searching code.

**Core behaviours:**
- Use tools proactively — don't just describe what to do, actually do it.
- Break complex tasks into steps: explore first, then act, then verify.
- If you are unsure about a file's current state, read it before touching it.
- When a shell command might be destructive, state what it will do before running it.
- Keep responses concise. Prefer code and tool output over long prose.`;
