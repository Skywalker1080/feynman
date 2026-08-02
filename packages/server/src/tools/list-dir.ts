import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import type { AgentTool } from './registry';

/** Directories that are too noisy / irrelevant to include in listings */
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'build',
  'coverage',
  '.cache',
  '__pycache__',
  '.venv',
  'venv',
]);

async function listRecursive(
  dirPath: string,
  depth: number,
  maxDepth: number,
): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [`(cannot read: ${dirPath})`];
  }

  // Sort: directories first, then files, both alphabetical
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const lines: string[] = [];
  const indent = '  '.repeat(depth);

  for (const entry of entries) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;

    if (entry.isDirectory()) {
      lines.push(`${indent}${entry.name}/`);
      if (depth < maxDepth) {
        const children = await listRecursive(
          path.join(dirPath, entry.name),
          depth + 1,
          maxDepth,
        );
        lines.push(...children);
      } else {
        lines.push(`${indent}  …`);
      }
    } else {
      lines.push(`${indent}${entry.name}`);
    }
  }

  return lines;
}

export const listDirTool: AgentTool = {
  name: 'list_dir',
  description:
    'List directory contents recursively up to a configurable depth. ' +
    'Skips node_modules, .git, dist, and other build/cache directories.',
  schema: z.object({
    path: z.string().describe('Absolute or relative path to the directory'),
    depth: z
      .number()
      .int()
      .min(1)
      .max(5)
      .optional()
      .default(2)
      .describe('Maximum recursion depth (default: 2, max: 5)'),
  }),
  async execute({ path: dirPath, depth = 2 }) {
    const resolved = path.resolve(dirPath);
    const lines = await listRecursive(resolved, 0, depth);
    return lines.length > 0 ? lines.join('\n') : '(empty directory)';
  },
};
