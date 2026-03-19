import type { LogEntry, LogFilter, Logger, LogLevel } from './types.js';

const globalLogs: LogEntry[] = [];
const loggers = new Map<string, LoggerImpl>();

class LoggerImpl implements Logger {
  private logs: LogEntry[] = [];
  
  constructor(private namespace: string) {}

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      namespace: this.namespace,
      agentId: context?.agentId as string | undefined,
      taskId: context?.taskId as string | undefined,
      context
    };
    
    this.logs.push(entry);
    globalLogs.push(entry);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  getLogs(filter?: LogFilter): LogEntry[] {
    if (!filter) {
      return [...this.logs];
    }

    return this.logs.filter(entry => {
      if (filter.level && entry.level !== filter.level) {
        return false;
      }
      if (filter.agentId && entry.agentId !== filter.agentId) {
        return false;
      }
      if (filter.taskId && entry.taskId !== filter.taskId) {
        return false;
      }
      if (filter.since && entry.timestamp < filter.since) {
        return false;
      }
      if (filter.until && entry.timestamp > filter.until) {
        return false;
      }
      return true;
    });
  }

  clear(): void {
    const namespaceLogs = this.logs.map(l => l);
    for (const log of namespaceLogs) {
      const globalIndex = globalLogs.indexOf(log);
      if (globalIndex !== -1) {
        globalLogs.splice(globalIndex, 1);
      }
    }
    this.logs = [];
  }
}

export function createLogger(namespace: string): Logger {
  let logger = loggers.get(namespace);
  if (!logger) {
    logger = new LoggerImpl(namespace);
    loggers.set(namespace, logger);
  }
  return logger;
}

export function getGlobalLogs(filter?: LogFilter): LogEntry[] {
  if (!filter) {
    return [...globalLogs];
  }

  return globalLogs.filter(entry => {
    if (filter.level && entry.level !== filter.level) {
      return false;
    }
    if (filter.agentId && entry.agentId !== filter.agentId) {
      return false;
    }
    if (filter.taskId && entry.taskId !== filter.taskId) {
      return false;
    }
    if (filter.since && entry.timestamp < filter.since) {
      return false;
    }
    if (filter.until && entry.timestamp > filter.until) {
      return false;
    }
    return true;
  });
}

export function clearGlobalLogs(): void {
  globalLogs.length = 0;
  for (const logger of loggers.values()) {
    logger.clear();
  }
}

export type { LogEntry, LogFilter, Logger, LogLevel };