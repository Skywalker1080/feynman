/**
 * One-line human-readable summary of a tool call, shown on the collapsed card.
 * Reads like a command line: "Read <path> [offset=N, limit=M]", "Run: <cmd>".
 * Detailed results stay hidden until the card is expanded.
 */
export function summarizeArgs(toolName: string, args: unknown): string {
  const a = (args ?? {}) as Record<string, unknown>;
  const path = typeof a.path === 'string' ? a.path : undefined;
  const clip = (s: string, n: number): string => truncate(s, n);
  switch (toolName) {
    case 'read_file': {
      const opts: string[] = [];
      if (typeof a.offset === 'number') opts.push(`offset=${a.offset}`);
      if (typeof a.limit === 'number') opts.push(`limit=${a.limit}`);
      return `Read ${clip(path ?? '', 60)}${opts.length > 0 ? ` [${opts.join(', ')}]` : ''}`;
    }
    case 'write_file':
      return `Write ${clip(path ?? '', 60)}`;
    case 'edit':
      return `Edit ${clip(path ?? '', 60)}`;
    case 'list_dir':
      return `List ${clip(path ?? '', 60)}${typeof a.depth === 'number' ? ` (depth ${a.depth})` : ''}`;
    case 'run_terminal':
      return `Run: ${clip(typeof a.command === 'string' ? a.command : '', 80)}`;
    case 'search':
      return `Search ${clip(`"${typeof a.pattern === 'string' ? a.pattern : ''}"`, 40)}${
        path ? ` in ${clip(path, 40)}` : ''
      }`;
    default:
      return clip(JSON.stringify(args ?? {}), 80);
  }
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
