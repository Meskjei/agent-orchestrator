import { spawn, ChildProcess } from 'child_process';
import { Writable, Readable } from 'stream';
import * as acp from '@agentclientprotocol/sdk';
import { AgentAdapter, AgentAdapterConfig, AdapterContext, AdapterResult, ToolCallRecord } from './adapter';
import { ACPConnectionPool } from './acp/connection';
import { LOCK_PROTOCOL_PROMPT } from './prompts/lock-protocol';

interface SessionUpdateCollector {
  messages: string[];
  toolCalls: ToolCallRecord[];
}

function createClientHandler(collector: SessionUpdateCollector): acp.Client {
  return {
    async requestPermission(params: acp.RequestPermissionRequest): Promise<acp.RequestPermissionResponse> {
      const defaultOption = params.options[0];
      return {
        outcome: {
          outcome: 'selected',
          optionId: defaultOption?.optionId || ''
        }
      };
    },

    async sessionUpdate(params: acp.SessionNotification): Promise<void> {
      const update = params.update;
      switch (update.sessionUpdate) {
        case 'agent_message_chunk':
          if (update.content.type === 'text') {
            collector.messages.push(update.content.text);
          }
          break;
        case 'tool_call':
          collector.toolCalls.push({
            tool: update.title || update.toolCallId,
            input: {},
            timestamp: Date.now()
          });
          break;
      }
    },

    async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
      return {};
    },

    async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
      return { content: '' };
    }
  };
}

/**
 * @deprecated Use ACPGateway from @agent-orchestrator/acp instead.
 * This adapter directly manages ACP protocol, but the new architecture
 * uses ACPGateway (platform layer) + Mastra Brain (orchestration).
 *
 * Migration:
 * ```typescript
 * // Old:
 * const adapter = new ACPClientAdapter({ ... });
 * const result = await adapter.execute({ task: '...' });
 *
 * // New:
 * const { agent, gateway } = createBrain({ llm: { provider: 'anthropic' } });
 * const result = await gateway.dispatch({ agentId: 'opencode', prompt: '...', cwd: '...' });
 * ```
 */
export class ACPClientAdapter implements AgentAdapter {
  config: AgentAdapterConfig;
  private connectionPool?: ACPConnectionPool;
  private process: ChildProcess | null = null;

  constructor(config: AgentAdapterConfig, connectionPool?: ACPConnectionPool) {
    this.config = {
      timeout: 300000,
      args: ['acp'],
      ...config
    };
    this.connectionPool = connectionPool;
  }

  async execute(context: AdapterContext): Promise<AdapterResult> {
    const collector: SessionUpdateCollector = {
      messages: [],
      toolCalls: []
    };
    const locksAcquired: string[] = [];
    const locksReleased: string[] = [];

    let proc: ChildProcess | null = null;

    try {
      if (this.connectionPool) {
        const acpConnection = await this.connectionPool.getConnection({
          command: this.config.command,
          args: this.config.args,
          cwd: this.config.cwd,
          env: this.config.env,
          timeout: this.config.timeout
        });
        proc = acpConnection.process;
      } else {
        proc = spawn(this.config.command, this.config.args || [], {
          cwd: this.config.cwd,
          env: { ...process.env, ...this.config.env },
          stdio: ['pipe', 'pipe', 'inherit']
        });
      }

      this.process = proc;

      const input = Writable.toWeb(proc.stdin!) as WritableStream<Uint8Array>;
      const output = Readable.toWeb(proc.stdout!) as ReadableStream<Uint8Array>;
      const stream = acp.ndJsonStream(input, output);
      const connection = new acp.ClientSideConnection((_agent) => createClientHandler(collector), stream);

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), this.config.timeout);
      });

      const initResult = await Promise.race([
        connection.initialize({
          protocolVersion: acp.PROTOCOL_VERSION,
          clientCapabilities: {
            fs: {
              readTextFile: true,
              writeTextFile: true
            }
          }
        }),
        timeoutPromise
      ]);

      const sessionResult = await Promise.race([
        connection.newSession({
          cwd: this.config.cwd || process.cwd(),
          mcpServers: []
        }),
        timeoutPromise
      ]);

      const fullPrompt = LOCK_PROTOCOL_PROMPT + '\n\n' + context.task;

      const promptResult = await Promise.race([
        connection.prompt({
          sessionId: sessionResult.sessionId,
          prompt: [
            {
              type: 'text',
              text: fullPrompt
            }
          ]
        }),
        timeoutPromise
      ]);

      return {
        output: collector.messages.join(''),
        artifacts: [],
        locksAcquired,
        locksReleased,
        toolCalls: collector.toolCalls
      };
    } catch (error) {
      return {
        output: collector.messages.join(''),
        error: error instanceof Error ? error.message : String(error),
        locksAcquired,
        locksReleased,
        toolCalls: collector.toolCalls
      };
    } finally {
      if (proc && !this.connectionPool) {
        proc.kill();
      }
      this.process = null;
    }
  }

  async getStatus(): Promise<{ online: boolean; error?: string }> {
    try {
      const proc = spawn(this.config.command, ['--version'], {
        stdio: 'pipe'
      });

      return new Promise((resolve) => {
        proc.on('close', (code) => {
          resolve({ online: code === 0 });
        });
        proc.on('error', (err) => {
          resolve({ online: false, error: err.message });
        });
      });
    } catch (e) {
      return { online: false, error: String(e) };
    }
  }

  async cancel(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}