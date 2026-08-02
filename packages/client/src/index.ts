import readline from 'readline';
import { ServerManager } from './server-manager';
import { ApiClient } from './api';
import { StreamRenderer } from './render';
import { handleResumeCommand } from './commands/resume';
import { handleNewCommand } from './commands/new';
import { handleSkillCommand } from './commands/skill';

async function main(): Promise<void> {
  console.log('\x1b[1m\x1b[34m⚛ Feynman Terminal Agent v0.1.0\x1b[0m');

  const serverManager = new ServerManager();
  await serverManager.ensureServerRunning();

  const api = new ApiClient(serverManager.baseUrl);
  const renderer = new StreamRenderer();

  // Create initial session for current working directory
  let currentSessionId = (await api.createSession(process.cwd())).sessionId;
  console.log(`Session active: \x1b[33m${currentSessionId}\x1b[0m`);
  console.log('Type your message or use commands (\x1b[36m/resume <id>\x1b[0m, \x1b[36m/new\x1b[0m, \x1b[36m/skill <name>\x1b[0m, \x1b[36m/exit\x1b[0m)\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\x1b[1m> \x1b[0m',
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === '/exit' || input === '/quit') {
      console.log('Goodbye!');
      process.exit(0);
    }

    if (input.startsWith('/resume ')) {
      const id = input.slice(8).trim();
      if (id) {
        currentSessionId = await handleResumeCommand(id, api, renderer);
      }
      rl.prompt();
      return;
    }

    if (input === '/new') {
      currentSessionId = await handleNewCommand(api, process.cwd());
      rl.prompt();
      return;
    }

    if (input.startsWith('/skill ')) {
      const skillName = input.slice(7).trim();
      if (skillName) {
        await handleSkillCommand(skillName, currentSessionId, api, renderer);
      }
      rl.prompt();
      return;
    }

    // Normal message to agent
    try {
      await api.sendMessage(currentSessionId, input, (ev) => renderer.renderEvent(ev));
    } catch (err: unknown) {
      console.error(`\x1b[31mError: ${(err as Error).message}\x1b[0m`);
    }

    rl.prompt();
  });
}

main().catch((err: unknown) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
