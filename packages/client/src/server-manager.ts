import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { HealthResponse } from '@feynman/types';

export class ServerManager {
  private serverProcess: ChildProcess | null = null;

  private static readonly here = path.dirname(fileURLToPath(import.meta.url));

  constructor(
    private readonly host: string = 'localhost',
    private readonly port: number = 3721,
    private readonly opts: { quiet?: boolean } = {},
  ) {}

  public get baseUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) return false;
      const data = (await res.json()) as HealthResponse;
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  async ensureServerRunning(): Promise<void> {
    const isRunning = await this.checkHealth();
    if (isRunning) return;

    if (!this.opts.quiet) console.log('⚡ Server not detected. Starting Feynman server background process...');

    // Attempt to locate server process:
    // 1. Local monorepo relative dist path
    // 2. Global `feynman-server` binary in PATH
    const localServerPath = path.resolve(ServerManager.here, '../../server/dist/index.js');
    if (fs.existsSync(localServerPath)) {
      this.serverProcess = spawn(process.execPath, [localServerPath], {
        detached: true,
        stdio: 'ignore',
        env: process.env,
      });
    } else {
      // Spawn feynman-server from PATH (global link)
      this.serverProcess = spawn('feynman-server', [], {
        shell: true,
        detached: true,
        stdio: 'ignore',
        env: process.env,
      });
    }

    this.serverProcess.unref();

    // Wait up to 5 seconds for health check to pass
    const start = Date.now();
    while (Date.now() - start < 5000) {
      await new Promise((r) => setTimeout(r, 250));
      if (await this.checkHealth()) {
        if (!this.opts.quiet) console.log('✅ Feynman server ready.');
        return;
      }
    }

    throw new Error('Failed to start Feynman server. Please run `npm run dev:server` or `feynman-server` manually.');
  }
}
