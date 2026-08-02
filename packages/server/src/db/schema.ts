import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Initialise (or open) the SQLite database, run schema migrations, and return
 * the database handle.
 *
 * @param dbPath Optional explicit path. Defaults to ~/.feynman/sessions.db
 */
export function initDb(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? path.join(os.homedir(), '.feynman', 'sessions.db');

  // Ensure the parent directory exists before opening the file
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const db = new Database(resolvedPath);

  // WAL mode: better read concurrency, safer crash recovery
  db.pragma('journal_mode = WAL');
  // Enforce FK constraints (SQLite disables them by default)
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      cwd         TEXT NOT NULL,
      provider    TEXT NOT NULL,
      model       TEXT NOT NULL,
      title       TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id        TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      turn_index        INTEGER NOT NULL,
      role              TEXT    NOT NULL,   -- 'user' | 'assistant' | 'tool'
      content           TEXT,               -- text content, null for pure tool_call messages
      tool_call_json    TEXT,               -- JSON array of AI SDK ToolCall objects
      tool_result_json  TEXT,               -- JSON array of AI SDK ToolResult objects
      created_at        TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session_id
      ON messages(session_id);
  `);

  return db;
}
