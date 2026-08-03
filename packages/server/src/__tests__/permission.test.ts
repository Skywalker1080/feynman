import { describe, it, expect } from 'vitest';
import type { SSEEvent } from '@feynman/types';
import { PermissionGate, PERMISSION_GATED_TOOLS } from '../permission';

const noop = (): void => undefined;
const collect = (events: SSEEvent[]) => (e: SSEEvent) => events.push(e);

describe('PermissionGate', () => {
  it('auto-approves when disabled (default) and emits no event', async () => {
    const gate = new PermissionGate(false);
    const events: SSEEvent[] = [];
    const decision = await gate.request('call-1', 'run_terminal', { command: 'rm -rf' }, collect(events));
    expect(decision).toBe('yes');
    expect(events).toHaveLength(0);
  });

  it('emits a permission-request and blocks until responded', async () => {
    const gate = new PermissionGate(true);
    const events: SSEEvent[] = [];
    let settled: string | null = null;
    const promise = gate
      .request('call-1', 'write_file', { path: 'a.txt' }, collect(events))
      .then((d) => (settled = d));

    expect(events).toEqual([
      { type: 'permission-request', id: 'call-1', toolName: 'write_file', args: { path: 'a.txt' } },
    ]);
    expect(settled).toBeNull();

    expect(gate.respond('call-1', 'yes')).toBe(true);
    await promise;
    expect(settled).toBe('yes');
  });

  it('respond no denies the call', async () => {
    const gate = new PermissionGate(true);
    const promise = gate.request('call-1', 'run_terminal', { command: 'x' }, noop);
    expect(gate.respond('call-1', 'no')).toBe(true);
    await expect(promise).resolves.toBe('no');
  });

  it('respond always persists the allowance for the session', async () => {
    const gate = new PermissionGate(true);
    const events: SSEEvent[] = [];

    const first = gate.request('call-1', 'write_file', {}, collect(events));
    expect(gate.respond('call-1', 'always')).toBe(true);
    await expect(first).resolves.toBe('always');

    // Second call for the same tool is auto-approved, no prompt
    const second = await gate.request('call-2', 'write_file', {}, collect(events));
    expect(second).toBe('yes');
    expect(events.filter((e) => e.type === 'permission-request')).toHaveLength(1);
  });

  it('still prompts for a different tool after an always allowance', async () => {
    const gate = new PermissionGate(true);
    const events: SSEEvent[] = [];
    const first = gate.request('call-1', 'write_file', {}, collect(events));
    expect(gate.respond('call-1', 'always')).toBe(true);
    await expect(first).resolves.toBe('always');

    const second = gate.request('call-2', 'run_terminal', {}, collect(events));
    expect(events.filter((e) => e.type === 'permission-request')).toHaveLength(2);
    expect(gate.respond('call-2', 'yes')).toBe(true);
    await expect(second).resolves.toBe('yes');
  });

  it('rejects with an AbortError when the turn is aborted while waiting', async () => {
    const gate = new PermissionGate(true);
    const controller = new AbortController();
    const promise = gate.request('call-1', 'run_terminal', {}, noop, controller.signal);

    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const gate = new PermissionGate(true);
    const controller = new AbortController();
    controller.abort();
    await expect(
      gate.request('call-1', 'run_terminal', {}, noop, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('respond returns false for an unknown tool call', () => {
    const gate = new PermissionGate(true);
    expect(gate.respond('missing', 'yes')).toBe(false);
  });

  it('rejectAll unblocks every pending request', async () => {
    const gate = new PermissionGate(true);
    const p1 = gate.request('call-1', 'write_file', {}, noop);
    const p2 = gate.request('call-2', 'run_terminal', {}, noop);
    gate.rejectAll(new Error('turn ended'));
    await expect(p1).rejects.toThrow('turn ended');
    await expect(p2).rejects.toThrow('turn ended');
  });
});

describe('PERMISSION_GATED_TOOLS', () => {
  it('gates exactly run_terminal and write_file', () => {
    expect(PERMISSION_GATED_TOOLS.sort()).toEqual(['run_terminal', 'write_file']);
  });
});
