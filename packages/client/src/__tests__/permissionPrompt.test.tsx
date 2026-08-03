import { describe, it, expect } from 'vitest';
import { renderToString } from 'ink';
import { PermissionPrompt } from '../ui/PermissionPrompt';
import { resolveTheme } from '../ui/theme';

const theme = resolveTheme({ noColor: true });

describe('PermissionPrompt', () => {
  const request = { id: 'call-1', toolName: 'run_terminal', argsSummary: 'rm -rf src' };

  it('shows the tool name, summary and key hints', () => {
    const out = renderToString(
      <PermissionPrompt request={request} theme={theme} onAnswer={() => undefined} onCancel={() => undefined} />,
    );
    expect(out).toContain('run_terminal');
    expect(out).toContain('rm -rf src');
    expect(out).toContain('[y]es [n]o [a]lways');
  });

  it('renders the write_file prompt with its path summary', () => {
    const out = renderToString(
      <PermissionPrompt
        request={{ id: 'call-2', toolName: 'write_file', argsSummary: 'src/foo.ts' }}
        theme={theme}
        onAnswer={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(out).toContain('write_file');
    expect(out).toContain('src/foo.ts');
  });
});
