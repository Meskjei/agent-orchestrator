import { spawn } from 'child_process';
import { AgentAdapter, AgentAdapterConfig, AdapterContext, AdapterResult } from './adapter';

export class CliAdapter implements AgentAdapter {
  config: AgentAdapterConfig;

  constructor(config: AgentAdapterConfig) {
    this.config = {
      timeout: 300000,
      args: [],
      cwd: process.cwd(),
      ...config
    };
  }

  async execute(context: AdapterContext): Promise<AdapterResult> {
    const args = this.buildArgs(context);
    
    return new Promise((resolve) => {
      const proc = spawn(this.config.command, args, {
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env },
        shell: true
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        proc.kill();
        resolve({ output: stdout, error: 'Command timed out' });
      }, this.config.timeout);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        resolve({
          output: stdout,
          error: code !== 0 ? stderr : undefined
        });
      });
    });
  }

  private buildArgs(context: AdapterContext): string[] {
    let args = [...(this.config.args || [])];
    
    if (this.config.inputTemplate) {
      const input = this.applyTemplate(this.config.inputTemplate, context);
      args.push(input);
    }
    
    return args;
  }

  private applyTemplate(template: string, context: AdapterContext): string {
    return template
      .replace(/\{\{task\}\}/g, context.task)
      .replace(/\{\{context\.(\w+)\}\}/g, (_, key) => {
        const val = context.context[key];
        return typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
      });
  }

  async getStatus(): Promise<{ online: boolean; error?: string }> {
    try {
      const result = await this.execute({ task: '--version', context: {} });
      return { online: !result.error };
    } catch (e) {
      return { online: false, error: String(e) };
    }
  }
}