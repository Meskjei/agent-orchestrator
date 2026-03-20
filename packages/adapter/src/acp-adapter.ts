import { spawn, ChildProcess } from 'child_process';
import { AgentAdapter, AgentAdapterConfig, AdapterContext, AdapterResult, ToolCallRecord } from './adapter';
import { createLockTools, LockToolsCallbacks } from './acp/tools';
import { ACPConnectionPool } from './acp/connection';
import { LOCK_PROTOCOL_PROMPT } from './prompts/lock-protocol';

export class ACPClientAdapter implements AgentAdapter {
  config: AgentAdapterConfig;
  private connectionPool?: ACPConnectionPool;
  private connection: ChildProcess | null = null;

  constructor(config: AgentAdapterConfig, connectionPool?: ACPConnectionPool) {
    this.config = {
      timeout: 300000,
      args: ['acp'],
      ...config
    };
    this.connectionPool = connectionPool;
  }

  async execute(context: AdapterContext): Promise<AdapterResult> {
    const locksAcquired: string[] = [];
    const locksReleased: string[] = [];
    const toolCalls: ToolCallRecord[] = [];

    const lockCallbacks: LockToolsCallbacks = {
      onDeclare: async (files: string[]) => {
        locksAcquired.push(...files);
        toolCalls.push({
          tool: 'lock_declare',
          input: { files },
          timestamp: Date.now()
        });
      },
      onRelease: async (files: string[]) => {
        locksReleased.push(...files);
        toolCalls.push({
          tool: 'lock_release',
          input: { files },
          timestamp: Date.now()
        });
      }
    };

    const lockTools = createLockTools(lockCallbacks);
    const fullPrompt = LOCK_PROTOCOL_PROMPT + '\n\n' + context.task;

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
          stdio: ['pipe', 'pipe', 'pipe']
        });
      }

      this.connection = proc;

      return await new Promise((resolve) => {
        let stdout = '';
        let stderr = '';

        proc!.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        proc!.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        const timeout = setTimeout(() => {
          proc!.kill();
          resolve({
            output: this.parseOutput(stdout),
            error: 'Command timed out',
            locksAcquired,
            locksReleased,
            toolCalls
          });
        }, this.config.timeout);

        proc!.on('close', (code) => {
          clearTimeout(timeout);
          this.connection = null;

          const output = this.parseOutput(stdout);

          resolve({
            output,
            error: code !== 0 ? stderr || `Exit code: ${code}` : undefined,
            locksAcquired,
            locksReleased,
            toolCalls
          });
        });

        proc!.on('error', (err) => {
          clearTimeout(timeout);
          this.connection = null;
          resolve({
            output: '',
            error: err.message,
            locksAcquired,
            locksReleased,
            toolCalls
          });
        });

        proc!.stdin?.write(fullPrompt);
        proc!.stdin?.end();
      });
    } catch (error) {
      return {
        output: '',
        error: error instanceof Error ? error.message : String(error),
        locksAcquired,
        locksReleased,
        toolCalls
      };
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
    if (this.connection) {
      this.connection.kill();
      this.connection = null;
    }
  }

  private parseOutput(stdout: string): string {
    const lines = stdout.split('\n');
    const textParts: string[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.type === 'text' && event.part?.text) {
          textParts.push(event.part.text);
        }
      } catch {
        textParts.push(line);
      }
    }

    return textParts.join('\n');
  }
}