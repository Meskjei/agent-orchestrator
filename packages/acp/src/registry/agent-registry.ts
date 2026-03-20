import { AgentDescriptor } from '../protocol/types.js';

export class AgentRegistry {
  private agents = new Map<string, AgentDescriptor>();

  constructor() {
    this.register({
      id: 'opencode',
      name: 'OpenCode',
      command: 'opencode',
      args: ['acp'],
      capabilities: ['typescript', 'javascript', 'python'],
      maxWorkers: 3,
    });

    this.register({
      id: 'claude',
      name: 'Claude Code',
      command: 'claude',
      args: ['acp'],
      capabilities: ['typescript', 'javascript', 'python', 'swift'],
      maxWorkers: 2,
    });
  }

  register(descriptor: AgentDescriptor): void {
    this.agents.set(descriptor.id, descriptor);
  }

  unregister(agentId: string): void {
    this.agents.delete(agentId);
  }

  getAgent(agentId: string): AgentDescriptor | null {
    return this.agents.get(agentId) ?? null;
  }

  listAgents(): AgentDescriptor[] {
    return Array.from(this.agents.values());
  }
}