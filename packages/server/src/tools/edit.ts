import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import type { AgentTool } from './registry';

/**
 * Targeted find-and-replace editor.
 *
 * Fails loudly if `old_str` is:
 *   - not found in the file (prevents silent no-ops)
 *   - found more than once (prevents wrong-location edits)
 *
 * This is the preferred tool for surgical edits — use `write_file` only
 * when you need to create or completely replace a file.
 */
export const editTool: AgentTool = {
  name: 'edit',
  description:
    'Make a targeted find-and-replace edit to a file. ' +
    '`old_str` must appear exactly once — the tool fails loudly if it is ' +
    'not found or appears multiple times (to prevent wrong-location edits). ' +
    'Add more context around the target string if it is not unique.',
  schema: z.object({
    path: z.string().describe('Absolute or relative path to the file to edit'),
    old_str: z
      .string()
      .describe(
        'The exact string to find and replace. Must appear exactly once in the file.',
      ),
    new_str: z.string().describe('The replacement string'),
  }),
  async execute({ path: filePath, old_str, new_str }) {
    const resolved = path.resolve(filePath);
    let content: string;

    try {
      content = await fs.readFile(resolved, 'utf-8');
    } catch (err: unknown) {
      throw new Error(
        `edit failed: cannot read '${resolved}': ${(err as Error).message}`,
      );
    }

    // Count occurrences without splitting the whole file
    let count = 0;
    let pos = content.indexOf(old_str);
    while (pos !== -1) {
      count++;
      pos = content.indexOf(old_str, pos + 1);
    }

    if (count === 0) {
      throw new Error(
        `edit failed: old_str not found in '${resolved}'.\n` +
          `Searched for:\n${old_str}`,
      );
    }

    if (count > 1) {
      throw new Error(
        `edit failed: old_str found ${count} times in '${resolved}'. ` +
          `It must be unique. Add more surrounding context to narrow it down.`,
      );
    }

    const updated = content.replace(old_str, new_str);
    await fs.writeFile(resolved, updated, 'utf-8');
    return `Edited '${resolved}' — replaced 1 occurrence.`;
  },
};
