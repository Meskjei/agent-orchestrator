import { describe, it, expect, beforeEach } from 'vitest';
import { LockManager } from '../manager';

describe('LockManager', () => {
  let manager: LockManager;

  beforeEach(() => {
    manager = new LockManager();
  });

  it('should acquire exclusive lock', async () => {
    const result = await manager.acquireLock({
      agentId: 'agent-1',
      taskId: 'task-1',
      files: ['file1.ts'],
      granularity: 'file',
      type: 'exclusive'
    });

    expect(result.granted).toBe(true);
    expect(result.lockId).toBeDefined();
  });

  it('should deny lock when file already locked', async () => {
    await manager.acquireLock({
      agentId: 'agent-1',
      taskId: 'task-1',
      files: ['file1.ts'],
      granularity: 'file',
      type: 'exclusive'
    });

    const result = await manager.acquireLock({
      agentId: 'agent-2',
      taskId: 'task-2',
      files: ['file1.ts'],
      granularity: 'file',
      type: 'exclusive'
    });

    expect(result.granted).toBe(false);
    expect(result.reason).toContain('locked');
  });

  it('should release lock', async () => {
    const acquireResult = await manager.acquireLock({
      agentId: 'agent-1',
      taskId: 'task-1',
      files: ['file1.ts'],
      granularity: 'file',
      type: 'exclusive'
    });

    await manager.releaseLock(acquireResult.lockId!);

    const locks = manager.getLocks();
    expect(locks.filter(l => l.status === 'active').length).toBe(0);
  });

  it('should queue waiting requests', async () => {
    await manager.acquireLock({
      agentId: 'agent-1',
      taskId: 'task-1',
      files: ['file1.ts'],
      granularity: 'file',
      type: 'exclusive'
    });

    const result = await manager.acquireLock({
      agentId: 'agent-2',
      taskId: 'task-2',
      files: ['file1.ts'],
      granularity: 'file',
      type: 'exclusive'
    });

    expect(result.granted).toBe(false);
    expect(result.waitingQueuePosition).toBe(1);
  });
});