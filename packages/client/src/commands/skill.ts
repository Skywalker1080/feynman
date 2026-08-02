import type { ApiClient } from '../api';
import type { StreamRenderer } from '../render';

export async function handleSkillCommand(
  skillName: string,
  sessionId: string,
  api: ApiClient,
  renderer: StreamRenderer,
): Promise<void> {
  try {
    const { content } = await api.getSkill(skillName);
    console.log(`\n\x1b[34m[Loading skill '${skillName}' into session]\x1b[0m`);

    const prompt = `[SKILL INSTRUCTION LOADED: ${skillName}]\n${content}`;
    await api.sendMessage(sessionId, prompt, (ev) => renderer.renderEvent(ev));
  } catch (err: unknown) {
    console.error(`\x1b[31m${(err as Error).message}\x1b[0m`);
  }
}
