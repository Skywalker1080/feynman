/** Named colors used across the UI. `undefined` means "no color" (NO_COLOR). */
export interface Theme {
  accent: string | undefined;
  border: string | undefined;
  muted: string | undefined;
  success: string | undefined;
  error: string | undefined;
  warning: string | undefined;
  user: string | undefined;
  assistant: string | undefined;
  tool: string | undefined;
  system: string | undefined;
  /** Per-tool color for the one-line tool-call summary. Unknown tools fall back to `tool`. */
  toolColors: Record<string, string | undefined>;
}

export interface ThemeOptions {
  noColor?: boolean;
}

export function noColorEnabled(): boolean {
  return process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '';
}

export function resolveTheme(opts: ThemeOptions = {}): Theme {
  const disabled = opts.noColor ?? noColorEnabled();
  const c = (color: string): string | undefined => (disabled ? undefined : color);
  return {
    accent: c('cyan'),
    border: c('#444444'),
    muted: c('gray'),
    success: c('green'),
    error: c('red'),
    warning: c('yellow'),
    user: c('white'),
    assistant: c('white'),
    tool: c('cyan'),
    system: c('yellow'),
    toolColors: {
      read_file: c('cyan'),
      list_dir: c('cyan'),
      search: c('magenta'),
      edit: c('yellow'),
      write_file: c('green'),
      run_terminal: c('magenta'),
    },
  };
}
