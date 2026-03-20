import { describe, it, expect, beforeEach } from 'vitest';
import { LockManager } from '../lock/lock-manager.js';

describe('LockManager', () => {
  let manager: LockManager;

  beforeEach(() => {
    manager = new LockManager();
  });

  it('should acquire lock on free file', () => {
    const result = manager.acquire(['a.ts'], 'worker-1');
    expect(result.granted).toEqual(['a.ts']);
    expect(result.denied).toEqual([]);
  });

  it('should deny lock on already locked file', () => {
    manager.acquire(['a.ts'], 'worker-1');
    const result = manager.acquire(['a.ts'], 'worker-2');
    expect(result.denied).toEqual(['a.ts']);
  });

  it('should allow same worker to re-acquire', () => {
    manager.acquire(['a.ts'], 'worker-1');
    const result = manager.acquire(['a.ts'], 'worker-1');
    expect(result.granted).toEqual(['a.ts']);
  });

  it('should release locks', () => {
    manager.acquire(['a.ts'], 'worker-1');
    manager.release(['a.ts'], 'worker-1');
    const result = manager.acquire(['a.ts'], 'worker-2');
    expect(result.granted).toEqual(['a.ts']);
  });

  it('should release all locks for worker', () => {
    manager.acquire(['a.ts', 'b.ts', 'c.ts'], 'worker-1');
    manager.releaseAll('worker-1');
    const status = manager.query(['a.ts', 'b.ts', 'c.ts']);
    expect(status.every((s) => !s.locked)).toBe(true);
  });

  it('should query lock status', () => {
    manager.acquire(['a.ts'], 'worker-1');
    const status = manager.query(['a.ts', 'b.ts']);
    expect(status[0].locked).toBe(true);
    expect(status[0].lockedBy).toBe('worker-1');
    expect(status[1].locked).toBe(false);
  });
});