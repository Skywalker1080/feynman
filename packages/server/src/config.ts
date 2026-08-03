import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Config } from '@feynman/types';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS: Config = {
  provider: 'lmstudio',
  model: 'qwen3-30b-a3b',
  lmstudio: {
    baseUrl: 'http://localhost:1234/v1',
  },
  openrouter: {
    apiKey: '',
  },
  allowlist: {
    lmstudio: ['qwen3-30b-a3b', 'qwen2.5-coder-32b-instruct', 'devstral-small-2505'],
    openrouter: [
      'anthropic/claude-sonnet-4-5',
      'anthropic/claude-opus-4',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'google/gemini-2.5-pro',
      'google/gemini-2.5-flash',
    ],
  },
  server: {
    port: 3721,
    host: 'localhost',
  },
  skills: {
    dir: '.agent/skills',
  },
  agent: {
    maxIterations: 25,
    permissionGate: false,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJsonFile(filePath: string): Partial<Config> {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as Partial<Config>;
  } catch {
    return {};
  }
}

/**
 * Deep-merge two partial Config objects, with `override` taking precedence.
 * Only one level deep — sub-objects (lmstudio, server, etc.) are shallow-merged.
 */
function mergeConfig(base: Config, override: Partial<Config>): Config {
  return {
    ...base,
    ...override,
    lmstudio: { ...base.lmstudio, ...override.lmstudio },
    openrouter: { ...base.openrouter, ...override.openrouter },
    allowlist: { ...base.allowlist, ...override.allowlist },
    server: { ...base.server, ...override.server },
    skills: { ...base.skills, ...override.skills },
    agent: { ...base.agent, ...override.agent },
  };
}

function parseEnvFile(cwd: string): void {
  const envPath = path.join(cwd, '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const raw = fs.readFileSync(envPath, 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // ignore read errors
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load and merge config from three sources (in precedence order, lowest first):
 *   1. Built-in defaults
 *   2. Global config: ~/.feynman/config.json
 *   3. Project-local config: <cwd>/.agent/config.json
 *   4. Environment variables / .env (highest precedence)
 */
export function loadConfig(cwd: string = process.cwd()): Config {
  parseEnvFile(cwd);

  const globalConfigPath = path.join(os.homedir(), '.feynman', 'config.json');
  const projectConfigPath = path.join(cwd, '.agent', 'config.json');

  const globalConfig = readJsonFile(globalConfigPath);
  const projectConfig = readJsonFile(projectConfigPath);

  let merged = mergeConfig(DEFAULTS, globalConfig);
  merged = mergeConfig(merged, projectConfig);

  // Environment variable overrides — highest precedence, never written to config files
  if (process.env['OPENROUTER_API_KEY']) {
    merged.openrouter.apiKey = process.env['OPENROUTER_API_KEY'];
  }
  if (process.env['LMSTUDIO_BASE_URL']) {
    merged.lmstudio.baseUrl = process.env['LMSTUDIO_BASE_URL'];
  }
  if (process.env['FEYNMAN_MODEL']) {
    merged.model = process.env['FEYNMAN_MODEL'];
  }
  if (process.env['FEYNMAN_PROVIDER']) {
    merged.provider = process.env['FEYNMAN_PROVIDER'] as Config['provider'];
  }
  if (process.env['FEYNMAN_PORT']) {
    merged.server.port = parseInt(process.env['FEYNMAN_PORT'], 10);
  }
  if (process.env['FEYNMAN_PERMISSION_GATE']) {
    merged.agent.permissionGate = ['1', 'true', 'yes'].includes(
      process.env['FEYNMAN_PERMISSION_GATE'].toLowerCase(),
    );
  }

  return merged;
}
