import { spawn, ChildProcess } from 'child_process';
import { ACPProtocolClient } from '../protocol/acp-client.js';
import { AgentDescriptor, DispatchRequest, DispatchResult, WorkerStatus } from '../protocol/types.js';

let nextWorkerId = 1;

export class Worker {
  readonly id: string;
  readonly agentId: string;
  status: WorkerStatus = 'pending';
  private client: ACPProtocolClient;

  constructor(agentId: string) {
    this.id = `worker-${nextWorkerId++}`;
    this.agentId = agentId;
    this.client = new ACPProtocolClient();
  }

  async run(descriptor: AgentDescriptor, request: DispatchRequest): Promise<DispatchResult> {
    this.status = 'running';

    const result = await this.client.execute(
      {
        command: descriptor.command,
        args: descriptor.args,
        cwd: request.cwd,
        timeout: request.timeout ?? 300000,
      },
      request.prompt,
    );

    this.status = result.error ? 'error' : 'completed';

    return {
      workerId: this.id,
      output: result.output,
      toolCalls: result.toolCalls,
      locksAcquired: [],
      locksReleased: [],
      error: result.error,
    };
  }

  cancel(): void {
    this.status = 'completed';
  }
}