import { LockManager, FileLock, LockGranularity, LockType } from '@agent-orchestrator/core';

export interface LockManagementInput {
  action: 'acquire' | 'release' | 'list' | 'release_all';
  agentId?: string;
  taskId?: string;
  files?: string[];
}

export interface LockManagementResult {
  success: boolean;
  lockId?: string;
  reason?: string;
  locks?: FileLock[];
}

export class LockManagementSkill {
  private lockManager: LockManager;

  constructor(lockManager: LockManager) {
    this.lockManager = lockManager;
  }

  async execute(input: LockManagementInput): Promise<LockManagementResult> {
    switch (input.action) {
      case 'acquire':
        return this.handleAcquire(input);
      case 'release':
        return this.handleRelease(input);
      case 'release_all':
        return this.handleReleaseAll(input);
      case 'list':
        return this.handleList(input);
      default:
        return { success: false, reason: `Unknown action: ${(input as any).action}` };
    }
  }

  private async handleAcquire(input: LockManagementInput): Promise<LockManagementResult> {
    if (!input.agentId || !input.taskId || !input.files?.length) {
      return {
        success: false,
        reason: 'acquire requires agentId, taskId, and files'
      };
    }

    const result = await this.lockManager.acquireLock({
      agentId: input.agentId,
      taskId: input.taskId,
      files: input.files,
      granularity: 'file' as LockGranularity,
      type: 'exclusive' as LockType
    });

    return {
      success: result.granted,
      lockId: result.lockId,
      reason: result.reason
    };
  }

  private async handleRelease(input: LockManagementInput): Promise<LockManagementResult> {
    if (!input.agentId || !input.files?.length) {
      return {
        success: false,
        reason: 'release requires agentId and files'
      };
    }

    const locks = this.lockManager.getLocks({ agentId: input.agentId });
    
    for (const file of input.files) {
      const lock = locks.find(l => l.file === file);
      if (lock) {
        await this.lockManager.releaseLock(lock.id);
      }
    }

    return { success: true };
  }

  private async handleReleaseAll(input: LockManagementInput): Promise<LockManagementResult> {
    if (!input.agentId) {
      return {
        success: false,
        reason: 'release_all requires agentId'
      };
    }

    await this.lockManager.releaseAllForAgent(input.agentId);
    return { success: true };
  }

  private handleList(input: LockManagementInput): LockManagementResult {
    const locks = this.lockManager.getLocks(
      input.agentId ? { agentId: input.agentId } : undefined
    );

    return {
      success: true,
      locks
    };
  }
}