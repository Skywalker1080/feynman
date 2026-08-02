import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import type { AgentTool } from './registry';

export const writeFileTool: AgentTool = {
  name: 'write_file',
  description:
    'Write content to a file, overwriting it if it exists. ' +
    'Creates parent directories automatically. ' +
    'WARNING: auto-runs with no confirmation — prefer `edit` for targeted changes.',
  schema: z.object({
    path: z.string().describe('Absolute or relative path to the file to write'),
    content: z.string().describe('The full content to write to the file'),
  }),
  async execute({ path: filePath, content }) {
    const resolved = path.resolve(filePath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, 'utf-8');
    return `Wrote ${content.length} characters to ${resolved}`;
  },
};
