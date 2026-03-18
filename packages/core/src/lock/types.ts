import { FileLock, LockGranularity, LockType, LockStatus, CodeRegion } from '../types';

export { FileLock, LockGranularity, LockType, LockStatus, CodeRegion };

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