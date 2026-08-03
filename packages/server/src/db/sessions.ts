import type Database from 'better-sqlite3';
import type { Message, Session } from '@feynman/types';

type NewSession = Omit<Session, 'created_at' | 'updated_at'>;
type NewMessage = Omit<Message, 'id' | 'created_at'>;

/**
 * Data-access layer for sessions and messages.
 * All methods are synchronous (better-sqlite3 is sync-only by design).
 */
export class SessionStore {
  constructor(private readonly db: Database.Database) {}

  /** Close the underlying SQLite connection (releases the file lock) */
  close(): void {
    this.db.close();
  }

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  createSession(data: NewSession): Session {
    const now = new Date().toISOString();
    const session: Session = { ...data, created_at: now, updated_at: now };

    this.db
      .prepare(
        `INSERT INTO sessions (id, created_at, updated_at, cwd, provider, model, title)
         VALUES (@id, @created_at, @updated_at, @cwd, @provider, @model, @title)`,
      )
      .run({ ...session, title: session.title ?? null });

    return session;
  }

  getSession(id: string): Session | undefined {
    return this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(id) as Session | undefined;
  }

  listSessions(): Session[] {
    return this.db
      .prepare('SELECT * FROM sessions ORDER BY updated_at DESC')
      .all() as Session[];
  }

  updateSessionTitle(id: string, title: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?')
      .run(title, now, id);
  }

  /** Touch updated_at — called after every completed agent turn */
  touchSession(id: string): void {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, id);
  }

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------

  appendMessage(msg: NewMessage): Message {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO messages
           (session_id, turn_index, role, content, tool_call_json, tool_result_json, created_at)
         VALUES
           (@session_id, @turn_index, @role, @content, @tool_call_json, @tool_result_json, @created_at)`,
      )
      .run({
        session_id: msg.session_id,
        turn_index: msg.turn_index,
        role: msg.role,
        content: msg.content ?? null,
        tool_call_json: msg.tool_call_json ?? null,
        tool_result_json: msg.tool_result_json ?? null,
        created_at: now,
      });

    return { ...msg, id: result.lastInsertRowid as number, created_at: now };
  }

  getMessages(sessionId: string): Message[] {
    return this.db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC')
      .all(sessionId) as Message[];
  }
}
