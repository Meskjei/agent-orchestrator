import { AgentRegistry } from './registry/agent-registry.js';
import { WorkerPool } from './pool/worker-pool.js';
import { LockManager } from './lock/lock-manager.js';
import {
  AgentDescriptor,
  DispatchRequest,
  DispatchResult,
  LockStatus,
} from './protocol/types.js';

export class ACPGateway {
  readonly registry: AgentRegistry;
  private pool: WorkerPool;
  private lockManager: LockManager;

  constructor() {
    this.registry = new AgentRegistry();
    this.pool = new WorkerPool(this.registry);
    this.lockManager = new LockManager();
  }

  registerAgent(descriptor: AgentDescriptor): void {
    this.registry.register(descriptor);
  }

  listAgents(): AgentDescriptor[] {
    return this.registry.listAgents();
  }

  async dispatch(request: DispatchRequest): Promise<DispatchResult> {
    if (request.files?.length) {
      const { denied } = this.lockManager.acquire(request.files, 'pending');
      if (denied.length > 0) {
        return {
          workerId: '',
          output: '',
          toolCalls: [],
          locksAcquired: [],
          locksReleased: [],
          error: `Files locked: ${denied.join(', ')}`,
        };
      }
    }

    const result = await this.pool.dispatch(request);

    if (request.files?.length && result.workerId) {
      this.lockManager.release(request.files, result.workerId);
    }

    return result;
  }

  async cancel(workerId: string): Promise<void> {
    this.lockManager.releaseAll(workerId);
    await this.pool.cancel(workerId);
  }

  queryLock(files: string[]): LockStatus[] {
    return this.lockManager.query(files);
  }

  getWorkerStatus(workerId: string) {
    return this.pool.getWorkerStatus(workerId);
  }
}