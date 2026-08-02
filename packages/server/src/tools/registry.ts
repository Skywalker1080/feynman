import { tool } from 'ai';
import type { CoreTool } from 'ai';
import type { z } from 'zod';

// ---------------------------------------------------------------------------
// AgentTool interface
// ---------------------------------------------------------------------------

/**
 * Internal shape for registering tools.
 * The `execute` function signature matches the AI SDK's expected executor.
 */
export interface AgentTool<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  /** Tool name used in function-calling schema (snake_case) */
  name: string;
  /** Human-readable description surfaced to the LLM */
  description: string;
  /** Zod schema for input validation + JSON Schema generation */
  schema: TSchema;
  /** Executor — must return a string result (surfaced to the model as tool output) */
  execute: (args: z.infer<TSchema>) => Promise<string>;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>();

  register(agentTool: AgentTool): void {
    this.tools.set(agentTool.name, agentTool);
  }

  /**
   * Returns tools in the Vercel AI SDK format, ready to pass into `streamText`.
   * Each tool has an `execute` function so the SDK auto-runs them during multi-step.
   */
  getAISDKTools(): Record<string, CoreTool> {
    const result: Record<string, CoreTool> = {};
    for (const [name, agentTool] of this.tools) {
      result[name] = tool({
        description: agentTool.description,
        parameters: agentTool.schema,
        execute: agentTool.execute,
      });
    }
    return result;
  }

  /** Returns name + description pairs for injecting into the system prompt */
  getManifest(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
    }));
  }
}
