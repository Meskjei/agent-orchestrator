import { spawn, ChildProcess } from 'child_process';
import { Writable, Readable } from 'stream';
import * as acp from '@agentclientprotocol/sdk';
import { ToolCall } from './types.js';

export interface ACPClientOptions {
  command: string;
  args: string[];
  cwd: string;
  timeout: number;
}

export interface ACPClientResult {
  output: string;
  toolCalls: ToolCall[];
  error?: string;
}

export class ACPProtocolClient {
  async execute(options: ACPClientOptions, prompt: string): Promise<ACPClientResult> {
    const proc = spawn(options.command, options.args, {
      cwd: options.cwd,
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    const toolCalls: ToolCall[] = [];
    const messages: string[] = [];

    const client = this.createClient(messages, toolCalls);
    const input = Writable.toWeb(proc.stdin!) as WritableStream<Uint8Array>;
    const output = Readable.toWeb(proc.stdout!) as ReadableStream<Uint8Array>;
    const stream = acp.ndJsonStream(input, output);
    const connection = new acp.ClientSideConnection(() => client, stream);

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), options.timeout);
      });

      await Promise.race([
        connection.initialize({
          protocolVersion: acp.PROTOCOL_VERSION,
          clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
        }),
        timeoutPromise,
      ]);

      const session = await Promise.race([
        connection.newSession({ cwd: options.cwd, mcpServers: [] }),
        timeoutPromise,
      ]);

      await Promise.race([
        connection.prompt({
          sessionId: session.sessionId,
          prompt: [{ type: 'text', text: prompt }],
        }),
        timeoutPromise,
      ]);

      return { output: messages.join(''), toolCalls };
    } catch (error) {
      return {
        output: messages.join(''),
        toolCalls,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      proc.kill();
    }
  }

  private createClient(messages: string[], toolCalls: ToolCall[]): acp.Client {
    return {
      async requestPermission(params) {
        return {
          outcome: { outcome: 'selected', optionId: params.options[0]?.optionId || '' },
        };
      },
      async sessionUpdate(params) {
        const update = params.update;
        if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
          messages.push(update.content.text);
        }
        if (update.sessionUpdate === 'tool_call') {
          toolCalls.push({ tool: update.title || update.toolCallId, input: {}, timestamp: Date.now() });
        }
      },
      async writeTextFile() {
        return {};
      },
      async readTextFile() {
        return { content: '' };
      },
    };
  }
}