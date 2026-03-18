import { describe, it, expect } from 'vitest';
import { ConflictDetector } from '../detector';
import { LockManager } from '../../lock/manager';

describe('ConflictDetector', () => {
  it('should detect path conflict', async () => {
    const lockManager = new LockManager();
    const detector = new ConflictDetector(lockManager);

    await lockManager.acquireLock({
      agentId: 'agent-1',
      taskId: 'task-1',
      files: ['file1.ts'],
      granularity: 'file',
      type: 'exclusive'
    });

    const report = await detector.detectConflicts([
      { file: 'file1.ts', type: 'modify', agentId: 'agent-2', description: 'Test' }
    ]);

    expect(report.hasConflicts).toBe(true);
    expect(report.pathConflicts.length).toBe(1);
    expect(report.pathConflicts[0].requestedBy).toBe('agent-2');
  });

  it('should return no conflicts when files not locked', async () => {
    const lockManager = new LockManager();
    const detector = new ConflictDetector(lockManager);

    const report = await detector.detectConflicts([
      { file: 'new-file.ts', type: 'create', agentId: 'agent-1', description: 'Test' }
    ]);

    expect(report.hasConflicts).toBe(false);
    expect(report.pathConflicts.length).toBe(0);
  });
});