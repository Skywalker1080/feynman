export interface SlashCommand {
  name: string;
  description: string;
  argHint?: string;
  aliases?: string[];
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'exit', aliases: ['quit'], description: 'Exit the CLI' },
  { name: 'new', description: 'Start a new session in the current directory' },
  { name: 'resume', description: 'Resume a previous session (interactive list)' },
  { name: 'skill', argHint: '<name>', description: 'Load a skill into the session' },
  { name: 'help', description: 'Show commands and keybindings' },
];

export interface ParsedCommand {
  name: string;
  arg?: string;
}

/** Parse a slash command line, resolving aliases. Returns null for non-commands / unknown commands. */
export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;
  const parts = trimmed.slice(1).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const [raw, ...rest] = parts;
  const cmd = SLASH_COMMANDS.find((c) => c.name === raw || (c.aliases ?? []).includes(raw));
  if (!cmd) return null;
  const arg = rest.join(' ');
  return arg ? { name: cmd.name, arg } : { name: cmd.name };
}

/** Commands whose name or alias starts with the given token prefix (leading `/` optional). */
export function matchCommands(token: string): SlashCommand[] {
  const q = token.startsWith('/') ? token.slice(1).toLowerCase() : token.toLowerCase();
  if (q === '') return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (c) => c.name.startsWith(q) || (c.aliases ?? []).some((a) => a.startsWith(q)),
  );
}

/** The leading slash token of the buffer (up to first whitespace), or null. */
export function currentSlashToken(buffer: string): string | null {
  if (!buffer.startsWith('/')) return null;
  const m = /^\/(\S*)/.exec(buffer);
  return m ? m[0] : null;
}
