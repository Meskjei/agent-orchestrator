import { describe, it, expect, beforeEach } from 'vitest';
import { LockManagementSkill } from '../lock-management';
import { LockManager } from '@agent-orchestrator/core';

describe('LockManagementSkill', () => {
  let lockManager: LockManager;
  let skill: LockManagementSkill;

  beforeEach(() => {
    lockManager = new LockManager();
    skill = new LockManagementSkill(lockManager);
  });

  it('should acquire lock', async () => {
    const result = await skill.execute({
      action: 'acquire',
      agentId: 'agent-1',
      taskId: 'task-1',
      files: ['file1.ts']
    });

    expect(result.success).toBe(true);
    expect(result.lockId).toBeDefined();
  });

  it('should release lock', async () => {
    await skill.execute({
      action: 'acquire',
      agentId: 'agent-1',
      taskId: 'task-1',
      files: ['file1.ts']
    });

    const result = await skill.execute({
      action: 'release',
      agentId: 'agent-1',
      files: ['file1.ts']
    });

    expect(result.success).toBe(true);
  });

  it('should list locks', async () => {
    await skill.execute({
      action: 'acquire',
      agentId: 'agent-1',
      taskId: 'task-1',
      files: ['file1.ts', 'file2.ts']
    });

    const result = await skill.execute({ action: 'list' });

    expect(result.locks?.length).toBe(2);
  });
});