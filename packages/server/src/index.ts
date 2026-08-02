import express from 'express';
import cors from 'cors';
import { loadConfig } from './config';
import { initDb } from './db/schema';
import { SessionStore } from './db/sessions';
import { ToolRegistry } from './tools/registry';
import { readFileTool } from './tools/read-file';
import { writeFileTool } from './tools/write-file';
import { listDirTool } from './tools/list-dir';
import { runTerminalTool } from './tools/run-terminal';
import { searchTool } from './tools/search';
import { editTool } from './tools/edit';
import { SkillsDiscovery } from './skills/discovery';
import { SessionLoop } from './loop/session-loop';
import { createProviderModel } from './providers';
import { createHealthRouter } from './routes/health';
import { createSessionsRouter } from './routes/sessions';
import { createSkillsRouter } from './routes/skills';

// ---------------------------------------------------------------------------
// Package version (injected by tsup / npm)
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PKG_VERSION: string = (require('../package.json') as { version: string }).version ?? 'dev';

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const config = loadConfig();

  // ── Database ──────────────────────────────────────────────────────────────
  const db = initDb();
  const sessionStore = new SessionStore(db);

  // ── Tools ─────────────────────────────────────────────────────────────────
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(readFileTool);
  toolRegistry.register(writeFileTool);
  toolRegistry.register(listDirTool);
  toolRegistry.register(runTerminalTool);
  toolRegistry.register(searchTool);
  toolRegistry.register(editTool);

  // ── Skills ────────────────────────────────────────────────────────────────
  const skillsDiscovery = new SkillsDiscovery(config.skills.dir, process.cwd());
  skillsDiscovery.discover();

  // ── Agent loop ────────────────────────────────────────────────────────────
  const sessionLoop = new SessionLoop(
    config,
    toolRegistry,
    sessionStore,
    skillsDiscovery,
    () => createProviderModel(config),
  );

  // ── HTTP server ───────────────────────────────────────────────────────────
  const app = express();

  app.use(
    cors({
      // Restrict to localhost origins in v1 — see spec §6.2
      origin: /^http:\/\/localhost(:\d+)?$/,
    }),
  );
  app.use(express.json({ limit: '10mb' }));

  app.use('/health', createHealthRouter(PKG_VERSION));
  app.use('/sessions', createSessionsRouter(sessionStore, sessionLoop, config));
  app.use('/skills', createSkillsRouter(skillsDiscovery));

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Global error handler
  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('[Server error]', err);
      res.status(500).json({ error: err.message });
    },
  );

  const { host, port } = config.server;

  app.listen(port, host, () => {
    console.log(`\n🧠 Feynman server v${PKG_VERSION}`);
    console.log(`   Listening at http://${host}:${port}`);
    console.log(`   Provider : ${config.provider}`);
    console.log(`   Model    : ${config.model}`);
    console.log(`   Skills   : ${config.skills.dir}`);
    console.log(`   DB       : ~/.feynman/sessions.db\n`);
  });
}

main().catch((err: unknown) => {
  console.error('Fatal: failed to start Feynman server:', err);
  process.exit(1);
});
