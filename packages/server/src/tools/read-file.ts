import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import type { AgentTool } from './registry';

export const readFileTool: AgentTool = {
  name: 'read_file',
  description:
    'Read the contents of a file. Returns the content with line numbers prefixed ' +
    '(e.g. "1: first line") — useful for targeted edits downstream.',
  schema: z.object({
    path: z.string().describe('Absolute or relative path to the file to read'),
  }),
  async execute({ path: filePath }) {
    const resolved = path.resolve(filePath);
    const content = await fs.readFile(resolved, 'utf-8');
    const lines = content.split('\n');
    // Pad line numbers for alignment on files > 9 lines
    const width = String(lines.length).length;
    return lines
      .map((line, i) => `${String(i + 1).padStart(width, ' ')}: ${line}`)
      .join('\n');
  },
};
