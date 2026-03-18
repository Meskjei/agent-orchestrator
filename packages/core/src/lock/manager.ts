import { FileLock, LockGranularity, LockType, CodeRegion } from '../types';

export interface LockRequest {
  agentId: string;
  taskId: string;
  files: string[];
  granularity: LockGranularity;
  regions?: CodeRegion[];
  type: LockType;
  expiresIn?: number;
}

export interface LockResult {
  granted: boolean;
  lockId?: string;
  reason?: string;
  waitingQueuePosition?: number;
}

export class LockManager {
  private locks: FileLock[] = [];
  private defaultExpiry = 30 * 60 * 1000;

  async acquireLock(request: LockRequest): Promise<LockResult> {
    const { agentId, taskId, files, granularity, type, expiresIn } = request;

    for (const file of files) {
      const existingLock = this.locks.find(
        l => l.file === file && l.status === 'active' && l.type === 'exclusive'
      );

      if (existingLock) {
        const queuePosition = existingLock.waitingQueue.length + 1;
        existingLock.waitingQueue.push({ agentId, taskId, requestedAt: new Date() });
        
        return {
          granted: false,
          reason: `File ${file} is locked by ${existingLock.holder.agentId}`,
          waitingQueuePosition: queuePosition
        };
      }
    }

    const lockId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + (expiresIn || this.defaultExpiry));

    for (const file of files) {
      const lock: FileLock = {
        id: lockId,
        file,
        granularity,
        holder: { agentId, taskId },
        type,
        status: 'active',
        acquiredAt: new Date(),
        expiresAt,
        waitingQueue: []
      };
      this.locks.push(lock);
    }

    return { granted: true, lockId };
  }

  async releaseLock(lockId: string): Promise<void> {
    const locksToRelease = this.locks.filter(l => l.id === lockId);
    
    for (const lock of locksToRelease) {
      lock.status = 'released';
      
      if (lock.waitingQueue.length > 0) {
        const next = lock.waitingQueue.shift()!;
        lock.holder = { agentId: next.agentId, taskId: next.taskId };
        lock.acquiredAt = new Date();
        lock.expiresAt = new Date(Date.now() + this.defaultExpiry);
        lock.status = 'active';
      }
    }
  }

  async releaseAllForAgent(agentId: string): Promise<void> {
    const agentLocks = this.locks.filter(l => l.holder.agentId === agentId && l.status === 'active');
    for (const lock of agentLocks) {
      await this.releaseLock(lock.id);
    }
  }

  getLocks(filters?: { agentId?: string; file?: string }): FileLock[] {
    let result = this.locks.filter(l => l.status === 'active');
    
    if (filters?.agentId) {
      result = result.filter(l => l.holder.agentId === filters.agentId);
    }
    if (filters?.file) {
      result = result.filter(l => l.file === filters.file);
    }
    
    return result;
  }

  getLockStatus(file: string): { locked: boolean; holder?: string } {
    const lock = this.locks.find(l => l.file === file && l.status === 'active');
    return {
      locked: !!lock,
      holder: lock?.holder.agentId
    };
  }

  async cleanupExpired(): Promise<void> {
    const now = new Date();
    const expired = this.locks.filter(l => l.status === 'active' && l.expiresAt && l.expiresAt < now);
    
    for (const lock of expired) {
      await this.releaseLock(lock.id);
    }
  }
}