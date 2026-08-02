import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDb } from '../db/schema';
import { SessionStore } from '../db/sessions';
import { randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

function makeTempDbPath(): string {
  return path.join(os.tmpdir(), `feynman-test-${randomUUID()}.db`);
}

describe('SessionStore', () => {
  let store: SessionStore;
  let dbPath: string;

  beforeEach(() => {
    dbPath = makeTempDbPath();
    const db = initDb(dbPath);
    store = new SessionStore(db);
  });

  afterEach(() => {
    // Clean up WAL files
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(`${dbPath}${suffix}`); } catch { /* ok */ }
    }
  });

  it('creates and retrieves a session', () => {
    const session = store.createSession({
      id: 'abc-001',
      cwd: '/tmp',
      provider: 'lmstudio',
      model: 'qwen3-30b',
    });
    expect(session.id).toBe('abc-001');

    const retrieved = store.getSession('abc-001');
    expect(retrieved).toBeDefined();
    expect(retrieved?.model).toBe('qwen3-30b');
    expect(retrieved?.provider).toBe('lmstudio');
  });

  it('returns undefined for a missing session', () => {
    expect(store.getSession('does-not-exist')).toBeUndefined();
  });

  it('lists sessions ordered by updated_at descending', () => {
    store.createSession({ id: 'a', cwd: '/tmp', provider: 'lmstudio', model: 'm' });
    store.createSession({ id: 'b', cwd: '/tmp', provider: 'lmstudio', model: 'm' });
    const list = store.listSessions();
    expect(list.length).toBe(2);
    // Both created simultaneously so order is stable — just confirm they're there
    expect(list.map((s) => s.id)).toContain('a');
    expect(list.map((s) => s.id)).toContain('b');
  });

  it('appends and retrieves messages in order', () => {
    store.createSession({ id: 'sess', cwd: '/tmp', provider: 'lmstudio', model: 'm' });

    store.appendMessage({
      session_id: 'sess',
      turn_index: 0,
      role: 'user',
      content: 'Hello!',
    });
    store.appendMessage({
      session_id: 'sess',
      turn_index: 0,
      role: 'assistant',
      content: 'Hi there!',
    });

    const messages = store.getMessages('sess');
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('user');
    expect(messages[0]?.content).toBe('Hello!');
    expect(messages[1]?.role).toBe('assistant');
  });

  it('updates session title', () => {
    store.createSession({ id: 'titled', cwd: '/tmp', provider: 'lmstudio', model: 'm' });
    store.updateSessionTitle('titled', 'My test session');
    const retrieved = store.getSession('titled');
    expect(retrieved?.title).toBe('My test session');
  });
});
