export * from './types';
export { ProjectBrainImpl } from './brain/brain';
export { BrainPersistence } from './brain/persistence';
export { LockManager } from './lock/manager';
export type { FileLock, LockGranularity, LockType, LockStatus, CodeRegion, LockState } from './types';
export type { LockRequest, LockResult } from './lock/types';
export { ConflictDetector } from './conflict/detector';