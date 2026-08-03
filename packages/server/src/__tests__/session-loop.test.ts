import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { simulateReadableStream, type ToolExecutionOptions } from 'ai';
import type { LanguageModelV1, LanguageModelV1StreamPart } from '@ai-sdk/provider';
import { initDb } from '../db/schema';
import { SessionStore } from '../db/sessions';
import { SessionLoop } from '../loop/session-loop';
import { ToolRegistry } from '../tools/registry';
import { SkillsDiscovery } from '../skills/discovery';
import { runTerminalTool } from '../tools/run-terminal';
import { writeFileTool } from '../tools/write-file';
import type { Config, SSEEvent } from '@feynman/types';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { z } from 'zod';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'feynman-loop-test-'));
}

function makeConfig(): Config {
  return {
    provider: 'lmstudio',
    model: 'qwen3-30b-a3b',
    lmstudio: { baseUrl: 'http://localhost:1234/v1' },
    openrouter: { apiKey: '' },
    allowlist: {
      lmstudio: ['qwen3-30b-a3b'],
      openrouter: ['openai/gpt-4o-mini'],
    },
    server: { port: 3721, host: 'localhost' },
    skills: { dir: '.agent/skills' },
    agent: { maxIterations: 5, permissionGate: false },
  };
}

/** Config with the permission gate switched on. */
function makePermConfig(): Config {
  return { ...makeConfig(), agent: { maxIterations: 5, permissionGate: true } };
}

/**
 * Build a fake LanguageModelV1 whose `doStream` replays a program of stream
 * parts, one program per SDK step invocation (so multi-step loops can be
 * scripted).
 */
function makeFakeModel(programs: LanguageModelV1StreamPart[][]): LanguageModelV1 {
  let callCount = 0;
  return {
    specificationVersion: 'v1',
    provider: 'fake',
    modelId: 'fake-model',
    defaultObjectGenerationMode: undefined,
    doGenerate: async () => ({
      text: '',
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0 },
      rawCall: { rawPrompt: '', rawSettings: {} },
    }),
    doStream: async () => {
      const program = programs[callCount] ?? programs[programs.length - 1]!;
      callCount += 1;
      return {
        stream: simulateReadableStream({ chunks: program }),
        rawCall: { rawPrompt: '', rawSettings: {} },
        rawResponse: { headers: {} },
      };
    },
  };
}

/**
 * Fake model whose stream emits `parts` and then hangs until the abort signal
 * fires (rejecting with AbortError) — simulates a real provider mid-stream.
 * `simulateReadableStream` can't do this (its delay is not abort-aware).
 */
function makeHangingModel(parts: LanguageModelV1StreamPart[]): LanguageModelV1 {
  return {
    specificationVersion: 'v1',
    provider: 'fake',
    modelId: 'fake-model',
    defaultObjectGenerationMode: undefined,
    doGenerate: async () => ({
      text: '',
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0 },
      rawCall: { rawPrompt: '', rawSettings: {} },
    }),
    doStream: async ({ abortSignal }) => {
      let emitted = false;
      return {
        stream: new ReadableStream<LanguageModelV1StreamPart>({
          async pull(controller) {
            if (!emitted) {
              emitted = true;
              controller.enqueue(parts[0]);
              return;
            }
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(resolve, 60_000);
              abortSignal?.addEventListener(
                'abort',
                () => {
                  clearTimeout(timer);
                  reject(new DOMException('The operation was aborted', 'AbortError'));
                },
                { once: true },
              );
            });
            controller.close();
          },
        }),
        rawCall: { rawPrompt: '', rawSettings: {} },
        rawResponse: { headers: {} },
      };
    },
  };
}

function toStreamParts(parts: LanguageModelV1StreamPart[]): LanguageModelV1StreamPart[] {
  return parts;
}

describe('SessionLoop', () => {
  let tmpDir: string;
  let dbPath: string;
  let store: SessionStore;
  let registry: ToolRegistry;
  let skills: SkillsDiscovery;

  beforeEach(() => {
    tmpDir = makeTempDir();
    dbPath = path.join(tmpDir, 'test.db');
    store = new SessionStore(initDb(dbPath));
    registry = new ToolRegistry();
    skills = new SkillsDiscovery('.agent/skills', tmpDir);
    skills.discover();
  });

  afterEach(() => {
    store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('emits status/usage/done events for a plain text turn', async () => {
    const sessionId = 'sess-1';
    store.createSession({
      id: sessionId,
      cwd: tmpDir,
      provider: 'lmstudio',
      model: 'qwen3-30b-a3b',
    });

    const model = makeFakeModel([
      toStreamParts([
        { type: 'text-delta', textDelta: 'Hello ' },
        { type: 'text-delta', textDelta: 'world' },
        { type: 'finish', finishReason: 'stop', usage: { promptTokens: 10, completionTokens: 5 } },
      ]),
    ]);

    const loop = new SessionLoop(makeConfig(), registry, store, skills, () => model as never);
    const events: SSEEvent[] = [];
    await loop.runTurn(sessionId, 'Say hi', (e) => events.push(e));

    const types = events.map((e) => e.type);
    expect(types).toContain('status');
    expect(types).toContain('usage');
    expect(types).toContain('done');

    const statuses = events
      .filter((e) => e.type === 'status')
      .map((e) => (e as { status: string }).status);
    expect(statuses).toEqual(['connecting', 'streaming', 'done']);

    const text = events
      .filter((e) => e.type === 'text-delta')
      .map((e) => (e as { delta: string }).delta)
      .join('');
    expect(text).toBe('Hello world');

    const usage = events.find((e) => e.type === 'usage');
    expect(usage).toMatchObject({
      type: 'usage',
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        cost: 0, // lmstudio is free
        model: 'qwen3-30b-a3b',
      },
    });
    expect(typeof (usage as { usage: { elapsedMs: number } }).usage.elapsedMs).toBe('number');
  });

  it('correlates tool-call and tool-result ids and emits step-start', async () => {
    const sessionId = 'sess-2';
    store.createSession({
      id: sessionId,
      cwd: tmpDir,
      provider: 'lmstudio',
      model: 'qwen3-30b-a3b',
    });

    registry.register({
      name: 'echo',
      description: 'Echo input back',
      schema: z.object({ text: z.string() }),
      execute: async ({ text }) => text,
    });

    const model = makeFakeModel([
      // Step 1: model calls the echo tool
      toStreamParts([
        {
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: 'call-1',
          toolName: 'echo',
          args: JSON.stringify({ text: 'ping' }),
        },
        {
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { promptTokens: 20, completionTokens: 10 },
        },
      ]),
      // Step 2: model answers after the tool ran
      toStreamParts([
        { type: 'text-delta', textDelta: 'Done' },
        { type: 'finish', finishReason: 'stop', usage: { promptTokens: 30, completionTokens: 15 } },
      ]),
    ]);

    const loop = new SessionLoop(makeConfig(), registry, store, skills, () => model as never);
    const events: SSEEvent[] = [];
    await loop.runTurn(sessionId, 'Use echo', (e) => events.push(e));

    const toolCall = events.find((e) => e.type === 'tool-call') as
      { type: 'tool-call'; id: string; toolName: string } | undefined;
    const toolResult = events.find((e) => e.type === 'tool-result') as
      { type: 'tool-result'; id: string } | undefined;

    expect(toolCall).toBeDefined();
    expect(toolResult).toBeDefined();
    expect(toolCall!.toolName).toBe('echo');
    expect(toolCall!.id).toBe('call-1');
    expect(toolResult!.id).toBe('call-1');

    expect(events.some((e) => e.type === 'step-start')).toBe(true);
    const stepStart = events.find((e) => e.type === 'step-start') as
      { type: 'step-start'; step: number; maxSteps: number } | undefined;
    expect(stepStart?.step).toBe(1);
    expect(stepStart?.maxSteps).toBe(5);
    expect(events.filter((e) => e.type === 'status')).toContainEqual({
      type: 'status',
      status: 'tool-running',
    });

    // Usage is the cumulative total from the final step
    const usage = events.find((e) => e.type === 'usage');
    expect(usage).toMatchObject({ type: 'usage' });
  });

  it('cancelTurn aborts an in-flight turn and emits cancelled', async () => {
    const sessionId = 'sess-3';
    store.createSession({
      id: sessionId,
      cwd: tmpDir,
      provider: 'lmstudio',
      model: 'qwen3-30b-a3b',
    });

    const model = makeHangingModel([{ type: 'text-delta', textDelta: 'started' }]);

    const loop = new SessionLoop(makeConfig(), registry, store, skills, () => model as never);

    const events: SSEEvent[] = [];
    const turnPromise = loop.runTurn(sessionId, 'run', (e) => events.push(e));

    // Give the stream a moment to start, then cancel
    await new Promise((r) => setTimeout(r, 50));
    expect(loop.cancelTurn(sessionId)).toBe(true);

    await turnPromise;

    const types = events.map((e) => e.type);
    expect(types).toContain('cancelled');
    expect(types).toContain('done');
    const statuses = events
      .filter((e) => e.type === 'status')
      .map((e) => (e as { status: string }).status);
    expect(statuses).toContain('cancelled');
    // No error should be emitted for a clean cancel
    expect(types).not.toContain('error');
  });

  it('cancelTurn returns false when no turn is running', async () => {
    const loop = new SessionLoop(makeConfig(), registry, store, skills, () => ({}) as never);
    expect(loop.cancelTurn('no-session')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Optional permission gate (ticket #7)
  // -------------------------------------------------------------------------

  const writeCall = (toolCallId: string, file: string): LanguageModelV1StreamPart => ({
    type: 'tool-call',
    toolCallType: 'function',
    toolCallId,
    toolName: 'write_file',
    args: JSON.stringify({ path: file, content: 'hi' }),
  });

  async function waitForPermission(events: SSEEvent[]): Promise<string> {
    await vi.waitFor(() => {
      expect(events.some((e) => e.type === 'permission-request')).toBe(true);
    });
    const perm = events.find((e) => e.type === 'permission-request') as { id: string } | undefined;
    expect(perm).toBeDefined();
    return perm!.id;
  }

  it('pauses a gated tool until permission is granted (yes)', async () => {
    const sessionId = 'sess-perm-yes';
    const outFile = path.join(tmpDir, 'out.txt');
    store.createSession({ id: sessionId, cwd: tmpDir, provider: 'lmstudio', model: 'qwen3-30b-a3b' });
    registry.register(writeFileTool);

    const model = makeFakeModel([
      toStreamParts([writeCall('call-w', outFile), { type: 'finish', finishReason: 'tool-calls', usage: { promptTokens: 10, completionTokens: 5 } }]),
      toStreamParts([{ type: 'text-delta', textDelta: 'Wrote it' }, { type: 'finish', finishReason: 'stop', usage: { promptTokens: 20, completionTokens: 10 } }]),
    ]);

    const loop = new SessionLoop(makePermConfig(), registry, store, skills, () => model as never);
    const events: SSEEvent[] = [];
    const turn = loop.runTurn(sessionId, 'write a file', (e) => events.push(e));
    const permId = await waitForPermission(events);

    // Tool is blocked: no result yet, no file written
    expect(events.some((e) => e.type === 'tool-result')).toBe(false);
    expect(fs.existsSync(outFile)).toBe(false);

    expect(loop.respondPermission(sessionId, permId, 'yes')).toBe(true);
    await turn;

    expect(fs.existsSync(outFile)).toBe(true);
    const text = events
      .filter((e) => e.type === 'text-delta')
      .map((e) => (e as { delta: string }).delta)
      .join('');
    expect(text).toContain('Wrote it');
  });

  it('refusing permission aborts the call', async () => {
    const sessionId = 'sess-perm-no';
    const outFile = path.join(tmpDir, 'out.txt');
    store.createSession({ id: sessionId, cwd: tmpDir, provider: 'lmstudio', model: 'qwen3-30b-a3b' });
    registry.register(writeFileTool);

    const model = makeFakeModel([
      toStreamParts([writeCall('call-n', outFile), { type: 'finish', finishReason: 'tool-calls', usage: { promptTokens: 10, completionTokens: 5 } }]),
      toStreamParts([{ type: 'text-delta', textDelta: 'Denied' }, { type: 'finish', finishReason: 'stop', usage: { promptTokens: 20, completionTokens: 10 } }]),
    ]);

    const loop = new SessionLoop(makePermConfig(), registry, store, skills, () => model as never);
    const events: SSEEvent[] = [];
    const turn = loop.runTurn(sessionId, 'write a file', (e) => events.push(e));
    const permId = await waitForPermission(events);

    expect(loop.respondPermission(sessionId, permId, 'no')).toBe(true);
    await turn;

    expect(fs.existsSync(outFile)).toBe(false);
    const toolResult = events.find((e) => e.type === 'tool-result') as { result: string } | undefined;
    expect(toolResult?.result).toContain('Permission denied');
  });

  it('always persists the allowance across turns in the session', async () => {
    const sessionId = 'sess-perm-always';
    const out1 = path.join(tmpDir, 'out1.txt');
    const out2 = path.join(tmpDir, 'out2.txt');
    store.createSession({ id: sessionId, cwd: tmpDir, provider: 'lmstudio', model: 'qwen3-30b-a3b' });
    registry.register(writeFileTool);

    const model = makeFakeModel([
      toStreamParts([writeCall('call-a1', out1), { type: 'finish', finishReason: 'tool-calls', usage: { promptTokens: 10, completionTokens: 5 } }]),
      toStreamParts([{ type: 'text-delta', textDelta: 'One' }, { type: 'finish', finishReason: 'stop', usage: { promptTokens: 20, completionTokens: 10 } }]),
      toStreamParts([writeCall('call-a2', out2), { type: 'finish', finishReason: 'tool-calls', usage: { promptTokens: 10, completionTokens: 5 } }]),
      toStreamParts([{ type: 'text-delta', textDelta: 'Two' }, { type: 'finish', finishReason: 'stop', usage: { promptTokens: 20, completionTokens: 10 } }]),
    ]);

    const loop = new SessionLoop(makePermConfig(), registry, store, skills, () => model as never);

    const e1: SSEEvent[] = [];
    const t1 = loop.runTurn(sessionId, 'write 1', (e) => e1.push(e));
    const permId = await waitForPermission(e1);
    loop.respondPermission(sessionId, permId, 'always');
    await t1;
    expect(fs.existsSync(out1)).toBe(true);

    // Second turn: same tool is auto-approved — no prompt
    const e2: SSEEvent[] = [];
    await loop.runTurn(sessionId, 'write 2', (e) => e2.push(e));
    expect(e2.some((e) => e.type === 'permission-request')).toBe(false);
    expect(fs.existsSync(out2)).toBe(true);
  });

  it('auto-executes gated tools when the gate is off (default)', async () => {
    const sessionId = 'sess-perm-off';
    const outFile = path.join(tmpDir, 'out.txt');
    store.createSession({ id: sessionId, cwd: tmpDir, provider: 'lmstudio', model: 'qwen3-30b-a3b' });
    registry.register(writeFileTool);

    const model = makeFakeModel([
      toStreamParts([writeCall('call-o', outFile), { type: 'finish', finishReason: 'tool-calls', usage: { promptTokens: 10, completionTokens: 5 } }]),
      toStreamParts([{ type: 'text-delta', textDelta: 'Wrote' }, { type: 'finish', finishReason: 'stop', usage: { promptTokens: 20, completionTokens: 10 } }]),
    ]);

    const loop = new SessionLoop(makeConfig(), registry, store, skills, () => model as never);
    const events: SSEEvent[] = [];
    await loop.runTurn(sessionId, 'write a file', (e) => events.push(e));

    expect(events.some((e) => e.type === 'permission-request')).toBe(false);
    expect(fs.existsSync(outFile)).toBe(true);
  });

  it('cancels cleanly when the turn is aborted while waiting for permission', async () => {
    const sessionId = 'sess-perm-cancel';
    const outFile = path.join(tmpDir, 'out.txt');
    store.createSession({ id: sessionId, cwd: tmpDir, provider: 'lmstudio', model: 'qwen3-30b-a3b' });
    registry.register(writeFileTool);

    const model = makeFakeModel([
      toStreamParts([writeCall('call-c', outFile), { type: 'finish', finishReason: 'tool-calls', usage: { promptTokens: 10, completionTokens: 5 } }]),
    ]);

    const loop = new SessionLoop(makePermConfig(), registry, store, skills, () => model as never);
    const events: SSEEvent[] = [];
    const turn = loop.runTurn(sessionId, 'write a file', (e) => events.push(e));
    const permId = await waitForPermission(events);

    expect(loop.cancelTurn(sessionId)).toBe(true);
    await turn;

    const types = events.map((e) => e.type);
    expect(types).toContain('cancelled');
    expect(types).not.toContain('error');
    expect(fs.existsSync(outFile)).toBe(false);
    expect(permId).toBeDefined();
  });
});

describe('runTerminalTool', () => {
  it('kills the command and settles when the turn is aborted', async () => {
    const controller = new AbortController();
    const startedAt = Date.now();

    const resultPromise = runTerminalTool.execute(
      { command: 'node -e "setTimeout(() => {}, 60000)"', timeout: 30_000 },
      { abortSignal: controller.signal } as ToolExecutionOptions,
    );

    // Let the child process start, then abort the turn
    await new Promise((r) => setTimeout(r, 200));
    controller.abort();

    const result = await resultPromise;
    expect(result).toContain('aborted');
    // Must resolve from the abort, not the 30s timeout
    expect(Date.now() - startedAt).toBeLessThan(5_000);
  }, 15_000);
});
