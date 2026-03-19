import { describe, it, expect, beforeEach } from 'vitest';
import { createLogger, getGlobalLogs, clearGlobalLogs } from '../logger';

describe('Logger', () => {
  let logger: ReturnType<typeof createLogger>;

  beforeEach(() => {
    clearGlobalLogs();
    logger = createLogger('test');
    logger.clear();
  });

  it('should log info messages', () => {
    logger.info('Test message');
    const logs = logger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe('info');
    expect(logs[0].message).toContain('Test message');
  });

  it('should log with context', () => {
    logger.info('Task started', { taskId: 'T001', agentId: 'agent-1' });
    const logs = logger.getLogs();
    expect(logs[0].agentId).toBe('agent-1');
    expect(logs[0].taskId).toBe('T001');
  });

  it('should filter logs by level', () => {
    logger.info('Info message');
    logger.error('Error message');
    logger.debug('Debug message');

    const errorLogs = logger.getLogs({ level: 'error' });
    expect(errorLogs.length).toBe(1);
    expect(errorLogs[0].message).toContain('Error message');
  });

  it('should filter logs by agent', () => {
    logger.info('Message 1', { agentId: 'agent-1' });
    logger.info('Message 2', { agentId: 'agent-2' });

    const agentLogs = logger.getLogs({ agentId: 'agent-1' });
    expect(agentLogs.length).toBe(1);
  });

  it('should log debug messages', () => {
    logger.debug('Debug message');
    const logs = logger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe('debug');
  });

  it('should log warn messages', () => {
    logger.warn('Warning message');
    const logs = logger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe('warn');
  });

  it('should log error messages', () => {
    logger.error('Error message');
    const logs = logger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe('error');
  });

  it('should include timestamp in log entries', () => {
    const before = new Date();
    logger.info('Test');
    const after = new Date();
    const logs = logger.getLogs();
    expect(logs[0].timestamp >= before).toBe(true);
    expect(logs[0].timestamp <= after).toBe(true);
  });

  it('should include namespace in log entries', () => {
    logger.info('Test');
    const logs = logger.getLogs();
    expect(logs[0].namespace).toBe('test');
  });

  it('should filter logs by taskId', () => {
    logger.info('Message 1', { taskId: 'T001' });
    logger.info('Message 2', { taskId: 'T002' });

    const taskLogs = logger.getLogs({ taskId: 'T001' });
    expect(taskLogs.length).toBe(1);
    expect(taskLogs[0].taskId).toBe('T001');
  });

  it('should filter logs by time range', async () => {
    logger.info('Message 1');
    await new Promise(r => setTimeout(r, 10));
    
    const mid = new Date();
    logger.info('Message 2');
    await new Promise(r => setTimeout(r, 10));
    
    const end = new Date();

    const logs = logger.getLogs({ since: mid, until: end });
    expect(logs.length).toBe(1);
    expect(logs[0].message).toBe('Message 2');
  });

  it('should clear logs', () => {
    logger.info('Message 1');
    logger.info('Message 2');
    expect(logger.getLogs().length).toBe(2);
    
    logger.clear();
    expect(logger.getLogs().length).toBe(0);
  });

  it('should return same logger instance for same namespace', () => {
    const logger1 = createLogger('test');
    const logger2 = createLogger('test');
    expect(logger1).toBe(logger2);
  });

  it('should return different logger instances for different namespaces', () => {
    const logger1 = createLogger('namespace1');
    const logger2 = createLogger('namespace2');
    expect(logger1).not.toBe(logger2);
  });

  it('should aggregate logs globally', () => {
    const logger1 = createLogger('ns1');
    const logger2 = createLogger('ns2');
    
    logger1.info('Message from ns1');
    logger2.info('Message from ns2');

    const allLogs = getGlobalLogs();
    expect(allLogs.length).toBe(2);
  });

  it('should filter global logs', () => {
    const logger1 = createLogger('ns1');
    const logger2 = createLogger('ns2');
    
    logger1.info('Info from ns1');
    logger2.error('Error from ns2');

    const errorLogs = getGlobalLogs({ level: 'error' });
    expect(errorLogs.length).toBe(1);
    expect(errorLogs[0].namespace).toBe('ns2');
  });

  it('should clear global logs', () => {
    logger.info('Message');
    expect(getGlobalLogs().length).toBe(1);
    
    clearGlobalLogs();
    expect(getGlobalLogs().length).toBe(0);
  });

  it('should preserve context object', () => {
    const context = { foo: 'bar', count: 42 };
    logger.info('Test', context);
    const logs = logger.getLogs();
    expect(logs[0].context).toEqual(context);
  });
});