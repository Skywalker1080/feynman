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
