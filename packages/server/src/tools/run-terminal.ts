import { spawn } from 'child_process';
import path from 'path';
import { z } from 'zod';
import type { ToolExecutionOptions } from 'ai';
import type { AgentTool } from './registry';

/**
 * Best-effort kill of the process tree rooted at `pid`.
 * On Windows `taskkill /T` kills children spawned by the shell (spawn uses
 * shell:true, so the child is not the direct process). On POSIX a detached
 * process group kill is used where possible.
 */
function killProcessTree(pid: number | undefined, fallback: () => void): void {
  if (!pid) {
    fallback();
    return;
  }
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F']);
  } else {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      fallback();
    }
  }
}

/**
 * Execute a shell command and capture stdout + stderr + exit code.
 *
 * ⚠️  Auto-runs with full user permissions, no sandboxing (v1 decision — see spec §6.3).
 * Aborting the agent turn (via options.abortSignal) kills the process tree.
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
  execute({ command, cwd, timeout = 30_000 }, options?: ToolExecutionOptions) {
    return new Promise<string>((resolve) => {
      const workDir = cwd ? path.resolve(cwd) : process.cwd();

      const proc = spawn(command, {
        shell: true,
        cwd: workDir,
        env: process.env,
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const settle = (message: string): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(message);
      };

      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      const timer = setTimeout(() => {
        killProcessTree(proc.pid, () => proc.kill('SIGTERM'));
        settle(
          [`TIMEOUT after ${timeout}ms`, stdout && `stdout:\n${stdout}`, stderr && `stderr:\n${stderr}`]
            .filter(Boolean)
            .join('\n'),
        );
      }, timeout);

      // Abort the agent turn -> kill the command immediately
      const abortHandler = (): void => {
        killProcessTree(proc.pid, () => proc.kill('SIGTERM'));
        settle('[command aborted]');
      };
      const signal = options?.abortSignal;
      if (signal) {
        if (signal.aborted) {
          abortHandler();
        } else {
          signal.addEventListener('abort', abortHandler, { once: true });
        }
      }

      proc.on('close', (code) => {
        if (signal) signal.removeEventListener('abort', abortHandler);
        const parts = [
          `exit_code: ${code ?? 'unknown'}`,
          stdout ? `stdout:\n${stdout}` : '',
          stderr ? `stderr:\n${stderr}` : '',
        ].filter(Boolean);
        settle(parts.join('\n'));
      });

      proc.on('error', (err) => {
        if (signal) signal.removeEventListener('abort', abortHandler);
        settle(`error: ${err.message}`);
      });
    });
  },
};
