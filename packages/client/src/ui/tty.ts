export interface TUIOptions {
  /** `--plain` forces line-streaming mode even in a TTY. */
  plain?: boolean;
  stdoutIsTTY?: boolean;
  stdinIsTTY?: boolean;
}

export function shouldUseTUI(opts: TUIOptions = {}): boolean {
  if (opts.plain) return false;
  const stdout = opts.stdoutIsTTY ?? process.stdout.isTTY;
  const stdin = opts.stdinIsTTY ?? process.stdin.isTTY;
  return Boolean(stdout && stdin);
}

/** True when the invocation explicitly asked for plain mode. */
export function requestedPlain(argv: string[]): boolean {
  return argv.includes('--plain') || argv.includes('-p');
}

/** True when the invocation asked for `--help` / `-h`. */
export function requestedHelp(argv: string[]): boolean {
  return argv.includes('--help') || argv.includes('-h');
}

export const USAGE_TEXT = `Usage: feynman [options]

Local, terminal-based coding agent (LM Studio + OpenRouter).

Options:
  -p, --plain   Force plain line-streaming output instead of the TUI.
                Useful for scripting and CI. Automatically enabled when
                stdout is not a TTY (piped / redirected).
  -h, --help    Show this help text.
`;
