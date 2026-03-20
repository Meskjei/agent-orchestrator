import { AgentRegistry } from '../registry/agent-registry.js';
import { Worker } from './worker.js';
import { DispatchRequest, DispatchResult, WorkerStatus } from '../protocol/types.js';

export class WorkerPool {
  private workers = new Map<string, Worker>();
  private registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  async dispatch(request: DispatchRequest): Promise<DispatchResult> {
    const descriptor = this.registry.getAgent(request.agentId);
    if (!descriptor) {
      return {
        workerId: '',
        output: '',
        toolCalls: [],
        locksAcquired: [],
        locksReleased: [],
        error: `Agent not found: ${request.agentId}`,
      };
    }

    const runningForAgent = Array.from(this.workers.values()).filter(
      (w) => w.agentId === request.agentId && w.status === 'running',
    ).length;

    if (runningForAgent >= descriptor.maxWorkers) {
      return {
        workerId: '',
        output: '',
        toolCalls: [],
        locksAcquired: [],
        locksReleased: [],
        error: `Agent ${request.agentId} has reached max workers (${descriptor.maxWorkers})`,
      };
    }

    const worker = new Worker(request.agentId);
    this.workers.set(worker.id, worker);

    const result = await worker.run(descriptor, request);

    this.workers.delete(worker.id);
    return result;
  }

  async cancel(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.cancel();
      this.workers.delete(workerId);
    }
  }

  getWorkerStatus(workerId: string): WorkerStatus | null {
    return this.workers.get(workerId)?.status ?? null;
  }

  listWorkers() {
    return Array.from(this.workers.values()).map((w) => ({
      id: w.id,
      agentId: w.agentId,
      status: w.status,
    }));
  }
}