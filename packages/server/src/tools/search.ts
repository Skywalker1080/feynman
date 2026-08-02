import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { z } from 'zod';
import type { AgentTool } from './registry';

const execFileAsync = promisify(execFile);

const SKIP_SEARCH_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'build',
  'coverage',
  '.cache',
]);

async function jsSearch(
  patternStr: string,
  targetPath: string,
  caseSensitive: boolean,
): Promise<string> {
  const flags = caseSensitive ? 'g' : 'gi';
  const regex = new RegExp(patternStr, flags);
  const matches: string[] = [];

  async function searchDir(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_SEARCH_DIRS.has(entry.name)) {
          await searchDir(path.join(dir, entry.name));
        }
      } else if (entry.isFile()) {
        const filePath = path.join(dir, entry.name);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!;
            if (regex.test(line)) {
              matches.push(`${filePath}:${i + 1}:${line.trim()}`);
              if (matches.length >= 100) return;
            }
            regex.lastIndex = 0;
          }
        } catch {
          // ignore unreadable binary/permission denied files
        }
      }
    }
  }

  const resolved = path.resolve(targetPath);
  const stat = await fs.stat(resolved).catch(() => null);
  if (!stat) return 'No matches found.';

  if (stat.isFile()) {
    try {
      const content = await fs.readFile(resolved, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (regex.test(line)) {
          matches.push(`${resolved}:${i + 1}:${line.trim()}`);
        }
        regex.lastIndex = 0;
      }
    } catch {
      return 'No matches found.';
    }
  } else {
    await searchDir(resolved);
  }

  return matches.length > 0 ? matches.join('\n') : 'No matches found.';
}

/**
 * Try ripgrep first (fast, respects .gitignore), fall back to system grep,
 * then fall back to pure JS recursive search on Windows/environments without CLI tools.
 */
async function runSearch(
  pattern: string,
  target: string,
  cwd: string,
  caseSensitive: boolean,
  include: string | undefined,
): Promise<string> {
  const rgArgs = [
    '--line-number',
    '--with-filename',
    '--max-count=100',
    caseSensitive ? '' : '--ignore-case',
    include ? `--glob=${include}` : '',
    '--',
    pattern,
    target,
  ].filter(Boolean);

  try {
    const { stdout } = await execFileAsync('rg', rgArgs, { cwd, maxBuffer: 1024 * 1024 });
    return stdout.trim() || 'No matches found.';
  } catch (rgErr: unknown) {
    if ((rgErr as NodeJS.ErrnoException).code === 1) return 'No matches found.';

    // Try system grep
    const grepArgs = [
      '-r',
      '-n',
      caseSensitive ? '' : '-i',
      include ? `--include=${include}` : '',
      '--',
      pattern,
      target,
    ].filter(Boolean);

    try {
      const { stdout } = await execFileAsync('grep', grepArgs, { cwd, maxBuffer: 1024 * 1024 });
      return stdout.trim() || 'No matches found.';
    } catch (grepErr: unknown) {
      if ((grepErr as NodeJS.ErrnoException).code === 1) return 'No matches found.';
      // Fallback to JS search if neither rg nor grep exist on host (ENOENT)
      return jsSearch(pattern, target, caseSensitive);
    }
  }
}

export const searchTool: AgentTool = {
  name: 'search',
  description:
    'Search for a text pattern across files. Uses ripgrep (rg) if available, ' +
    'falls back to system grep. Supports regex patterns.',
  schema: z.object({
    pattern: z.string().describe('Search pattern (supports regular expressions)'),
    path: z
      .string()
      .optional()
      .describe('Directory or file to search (defaults to current working directory)'),
    case_sensitive: z.boolean().optional().default(false),
    include: z
      .string()
      .optional()
      .describe('Glob to filter files, e.g. "*.ts" or "*.{ts,js}"'),
  }),
  async execute({ pattern, path: searchPath, case_sensitive = false, include }) {
    const cwd = process.cwd();
    const target = searchPath ? searchPath : cwd;
    return runSearch(pattern, target, cwd, case_sensitive, include);
  },
};
