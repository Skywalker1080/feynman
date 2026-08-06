import type { SSEEvent } from '@feynman/types';

export class StreamRenderer {
  private currentToolCall: string | null = null;

  renderEvent(event: SSEEvent): void {
    switch (event.type) {
      case 'text-delta':
        process.stdout.write(event.delta);
        break;

      case 'tool-call': {
        this.currentToolCall = event.toolName;
        const argsStr = JSON.stringify(event.args);
        const truncatedArgs = argsStr.length > 80 ? `${argsStr.slice(0, 77)}...` : argsStr;
        process.stdout.write(`\n\x1b[36m[tool: ${event.toolName} ${truncatedArgs}]\x1b[0m\n`);
        break;
      }

      case 'tool-result': {
        const preview = event.result.replace(/\n/g, ' ').slice(0, 100);
        const truncated = event.result.length > 100 ? `${preview}...` : preview;
        process.stdout.write(`\x1b[32m[result: ${truncated}]\x1b[0m\n`);
        this.currentToolCall = null;
        break;
      }

      case 'session-start-disclaimer':
        process.stdout.write(`\n\x1b[33m${event.message}\x1b[0m\n\n`);
        break;

      case 'error':
        process.stdout.write(`\n\x1b[31m[Error: ${event.message}]\x1b[0m\n`);
        break;

      case 'done':
        process.stdout.write('\n');
        if (event.finishReason === 'length') {
          process.stdout.write('\x1b[2m(finished: max steps reached — reply to continue)\x1b[0m\n');
        } else if (event.emptyAfterTools) {
          process.stdout.write(
            '\x1b[2m(model returned no final response — reply to have it summarize)\x1b[0m\n',
          );
        }
        break;
    }
  }
}
