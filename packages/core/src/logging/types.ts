export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  agentId?: string;
  taskId?: string;
  namespace: string;
}

export interface LogFilter {
  level?: LogLevel;
  agentId?: string;
  taskId?: string;
  since?: Date;
  until?: Date;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  getLogs(filter?: LogFilter): LogEntry[];
  clear(): void;
}