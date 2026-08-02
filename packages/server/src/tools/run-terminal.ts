import { spawn } from 'child_process';
import path from 'path';
import { z } from 'zod';
import type { AgentTool } from './registry';

/**
 * Execute a shell command and capture stdout + stderr + exit code.
 *
 * ⚠️  Auto-runs with full user permissions, no sandboxing (v1 decision — see spec §6.3).
 */
export const runTerminalTool: AgentTool = {
  name: 'run_terminal',
  description:
    'Execute a shell command and return its stdout, stderr, and exit code. ' +
    'WARNING: auto-executes with full user permissions and no sandboxing.',
  schema: z.object({
    command: z.string().describe('The shell command to run'),
    cwd: z
      .string()
      .optional()
      .describe('Working directory for the command (defaults to server cwd)'),
    timeout: z
      .number()
      .int()
      .positive()
      .optional()
      .default(30_000)
      .describe('Timeout in milliseconds (default: 30000)'),
  }),
  execute({ command, cwd, timeout = 30_000 }) {
    return new Promise<string>((resolve) => {
      const workDir = cwd ? path.resolve(cwd) : process.cwd();

      const proc = spawn(command, {
        shell: true,
        cwd: workDir,
        env: process.env,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        resolve(
          [`TIMEOUT after ${timeout}ms`, stdout && `stdout:\n${stdout}`, stderr && `stderr:\n${stderr}`]
            .filter(Boolean)
            .join('\n'),
        );
      }, timeout);

      proc.on('close', (code) => {
        clearTimeout(timer);
        const parts = [
          `exit_code: ${code ?? 'unknown'}`,
          stdout ? `stdout:\n${stdout}` : '',
          stderr ? `stderr:\n${stderr}` : '',
        ].filter(Boolean);
        resolve(parts.join('\n'));
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve(`error: ${err.message}`);
      });
    });
  },
};
