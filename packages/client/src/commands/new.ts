import type { ApiClient } from '../api';

export async function handleNewCommand(api: ApiClient, cwd: string): Promise<string> {
  const { session } = await api.createSession(cwd);
  console.log(`\n\x1b[32mStarted new session: ${session.id}\x1b[0m\n`);
  return session.id;
}
