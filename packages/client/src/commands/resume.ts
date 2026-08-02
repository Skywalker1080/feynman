import type { ApiClient } from '../api';
import type { StreamRenderer } from '../render';

export async function handleResumeCommand(
  chatId: string,
  api: ApiClient,
  _renderer: StreamRenderer,
): Promise<string> {
  try {
    const { session, messages } = await api.getSession(chatId);

    console.log(`\n\x1b[35m=== Resumed Session ${session.id} (${session.model}) ===\x1b[0m\n`);

    for (const msg of messages) {
      if (msg.role === 'user' && msg.content) {
        console.log(`\x1b[1m> ${msg.content}\x1b[0m\n`);
      } else if (msg.role === 'assistant' && msg.content) {
        console.log(`${msg.content}\n`);
      } else if (msg.role === 'assistant' && msg.tool_call_json) {
        try {
          const calls = JSON.parse(msg.tool_call_json) as Array<{ toolName: string }>;
          for (const c of calls) {
            console.log(`\x1b[36m[tool: ${c.toolName}]\x1b[0m`);
          }
        } catch {
          // ignore
        }
      }
    }

    return session.id;
  } catch (err: unknown) {
    console.error(`\x1b[31m${(err as Error).message}\x1b[0m`);
    return chatId;
  }
}
