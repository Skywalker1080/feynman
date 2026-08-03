/**
 * One-line argument summary for a tool call, shown on the collapsed card.
 * Keeps the card header compact: tool name + short human-readable args.
 */
export function summarizeArgs(toolName: string, args: unknown): string {
  const a = (args ?? {}) as Record<string, unknown>;
  const path = typeof a.path === 'string' ? a.path : undefined;
  switch (toolName) {
    case 'edit':
    case 'write_file':
      return path ? truncate(path, 60) : '';
    case 'read_file':
    case 'list_dir':
      return path ? truncate(path, 60) : '';
    case 'run_terminal':
      return typeof a.command === 'string' ? truncate(a.command, 80) : '';
    case 'search':
      return typeof a.pattern === 'string' ? `~ ${truncate(a.pattern, 40)}` : '';
    default:
      return truncate(JSON.stringify(args ?? {}), 80);
  }
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
