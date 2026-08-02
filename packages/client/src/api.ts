import { createParser } from 'eventsource-parser';
import type {
  CreateSessionResponse,
  GetSessionResponse,
  GetSkillResponse,
  ListSessionsResponse,
  ListSkillsResponse,
  SSEEvent,
} from '@feynman/types';

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async createSession(cwd: string): Promise<CreateSessionResponse> {
    const res = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cwd }),
    });

    if (!res.ok) {
      throw new Error(`Failed to create session: ${res.statusText}`);
    }

    return (await res.json()) as CreateSessionResponse;
  }

  async listSessions(): Promise<ListSessionsResponse> {
    const res = await fetch(`${this.baseUrl}/sessions`);
    if (!res.ok) throw new Error(`Failed to list sessions: ${res.statusText}`);
    return (await res.json()) as ListSessionsResponse;
  }

  async getSession(id: string): Promise<GetSessionResponse> {
    const res = await fetch(`${this.baseUrl}/sessions/${id}`);
    if (!res.ok) throw new Error(`Session '${id}' not found`);
    return (await res.json()) as GetSessionResponse;
  }

  async listSkills(): Promise<ListSkillsResponse> {
    const res = await fetch(`${this.baseUrl}/skills`);
    if (!res.ok) throw new Error(`Failed to list skills: ${res.statusText}`);
    return (await res.json()) as ListSkillsResponse;
  }

  async getSkill(name: string): Promise<GetSkillResponse> {
    const res = await fetch(`${this.baseUrl}/skills/${name}`);
    if (!res.ok) throw new Error(`Skill '${name}' not found`);
    return (await res.json()) as GetSkillResponse;
  }

  async sendMessage(
    sessionId: string,
    message: string,
    onEvent: (event: SSEEvent) => void,
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Failed to send message: ${res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    const parser = createParser((event) => {
      if (event.type === 'event') {
        try {
          const data = JSON.parse(event.data) as SSEEvent;
          onEvent(data);
        } catch {
          // Skip unparseable
        }
      }
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
    }
  }
}
