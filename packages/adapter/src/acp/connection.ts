import { spawn, ChildProcess } from 'child_process';

export interface ACPConnectionConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface ACPConnection {
  process: ChildProcess;
  config: ACPConnectionConfig;
  ready: boolean;
}

export class ACPConnectionPool {
  private connections: Map<string, ACPConnection> = new Map();
  private defaultTimeout: number;

  constructor(defaultTimeout: number = 300000) {
    this.defaultTimeout = defaultTimeout;
  }

  async getConnection(config: ACPConnectionConfig): Promise<ACPConnection> {
    const key = this.getConnectionKey(config);
    
    if (this.connections.has(key)) {
      const existing = this.connections.get(key)!;
      if (existing.ready && !this.isProcessDead(existing.process)) {
        return existing;
      }
      await this.closeConnection(key);
    }

    return this.createConnection(config);
  }

  private async createConnection(config: ACPConnectionConfig): Promise<ACPConnection> {
    const proc = spawn(config.command, config.args || [], {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const connection: ACPConnection = {
      process: proc,
      config,
      ready: false
    };

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, config.timeout || this.defaultTimeout);

      proc.on('spawn', () => {
        clearTimeout(timeout);
        connection.ready = true;
        resolve();
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    const key = this.getConnectionKey(config);
    this.connections.set(key, connection);
    return connection;
  }

  async close(name: string): Promise<void> {
    const key = this.findKeyByName(name);
    if (key) {
      await this.closeConnection(key);
    }
  }

  async closeAll(): Promise<void> {
    for (const key of this.connections.keys()) {
      await this.closeConnection(key);
    }
  }

  private async closeConnection(key: string): Promise<void> {
    const connection = this.connections.get(key);
    if (connection) {
      connection.process.kill();
      this.connections.delete(key);
    }
  }

  private isProcessDead(proc: ChildProcess): boolean {
    return proc.killed || proc.exitCode !== null;
  }

  private getConnectionKey(config: ACPConnectionConfig): string {
    const argsKey = (config.args || []).join(',');
    return `${config.command}:${argsKey}:${config.cwd || process.cwd()}`;
  }

  private findKeyByName(name: string): string | null {
    for (const [key] of this.connections) {
      if (key.startsWith(name)) return key;
    }
    return null;
  }
}