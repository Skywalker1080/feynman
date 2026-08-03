import type { PermissionDecision, SSEEvent } from '@feynman/types';

/**
 * Tools that require a confirmation prompt when the permission gate is on.
 * `edit` and non-destructive tools are intentionally not gated (see ticket #7).
 */
export const PERMISSION_GATED_TOOLS = ['run_terminal', 'write_file'];

function abortError(): Error {
  const err = new Error('The operation was aborted');
  err.name = 'AbortError';
  return err;
}

type PendingRequest = {
  toolName: string;
  settle: (decision: PermissionDecision | null, error?: unknown) => void;
};

/**
 * Optional confirmation gate for destructive tools.
 *
 * When disabled (default), `request` resolves immediately with `yes` — the
 * tool auto-executes exactly as before. When enabled, `request` emits a
 * `permission-request` SSE event and blocks until the client answers via
 * `respond` (or the turn is aborted). An `always` answer remembers the tool
 * name for the rest of the session, so later calls skip the prompt.
 */
export class PermissionGate {
  private readonly alwaysAllowed = new Set<string>();
  private readonly pending = new Map<string, PendingRequest>();

  constructor(private readonly enabled: boolean) {}

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Ask the client whether `toolName` may run. Resolves with the decision:
   * `yes` proceeds, `no` aborts the call, `always` proceeds and remembers.
   * Rejects with an AbortError if the turn is cancelled while waiting.
   */
  request(
    toolCallId: string,
    toolName: string,
    args: unknown,
    onEvent: (event: SSEEvent) => void,
    abortSignal?: AbortSignal,
  ): Promise<PermissionDecision> {
    if (!this.enabled) return Promise.resolve('yes');
    if (this.alwaysAllowed.has(toolName)) return Promise.resolve('yes');

    return new Promise<PermissionDecision>((resolve, reject) => {
      let settled = false;

      const cleanup = (): void => {
        if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
        this.pending.delete(toolCallId);
      };

      const settle = (decision: PermissionDecision | null, error?: unknown): void => {
        if (settled) return;
        settled = true;
        cleanup();
        if (decision === 'always') this.alwaysAllowed.add(toolName);
        if (decision === null) reject(error);
        else resolve(decision);
      };

      const onAbort = (): void => settle(null, abortError());

      if (abortSignal) {
        if (abortSignal.aborted) {
          settle(null, abortError());
          return;
        }
        abortSignal.addEventListener('abort', onAbort, { once: true });
      }

      this.pending.set(toolCallId, { toolName, settle });
      onEvent({ type: 'permission-request', id: toolCallId, toolName, args });
    });
  }

  /** Resolve a pending request from the client. Returns false if none is pending. */
  respond(toolCallId: string, decision: PermissionDecision): boolean {
    const request = this.pending.get(toolCallId);
    if (!request) return false;
    request.settle(decision);
    return true;
  }

  /** Reject every still-pending request (e.g. the turn ended while waiting). */
  rejectAll(error: unknown): void {
    for (const request of this.pending.values()) request.settle(null, error);
  }
}
