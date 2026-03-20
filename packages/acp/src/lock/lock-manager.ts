import { LockStatus } from '../protocol/types.js';

export class LockManager {
  private locks = new Map<string, { workerId: string; lockedAt: number }>();

  acquire(files: string[], workerId: string): { granted: string[]; denied: string[] } {
    const granted: string[] = [];
    const denied: string[] = [];

    for (const file of files) {
      const existing = this.locks.get(file);
      if (existing && existing.workerId !== workerId) {
        denied.push(file);
      } else {
        this.locks.set(file, { workerId, lockedAt: Date.now() });
        granted.push(file);
      }
    }

    return { granted, denied };
  }

  release(files: string[], workerId: string): void {
    for (const file of files) {
      const existing = this.locks.get(file);
      if (existing?.workerId === workerId) {
        this.locks.delete(file);
      }
    }
  }

  releaseAll(workerId: string): void {
    for (const [file, lock] of this.locks.entries()) {
      if (lock.workerId === workerId) {
        this.locks.delete(file);
      }
    }
  }

  query(files: string[]): LockStatus[] {
    return files.map((file) => {
      const lock = this.locks.get(file);
      return {
        file,
        locked: !!lock,
        lockedBy: lock?.workerId,
        lockedAt: lock?.lockedAt,
      };
    });
  }
}