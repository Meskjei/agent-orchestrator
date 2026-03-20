import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry } from '../registry/agent-registry.js';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it('should have default agents registered', () => {
    const agents = registry.listAgents();
    expect(agents.length).toBe(2);
    expect(agents.map((a) => a.id)).toContain('opencode');
    expect(agents.map((a) => a.id)).toContain('claude');
  });

  it('should register new agent', () => {
    registry.register({
      id: 'test-agent',
      name: 'Test Agent',
      command: 'test',
      args: [],
      capabilities: ['typescript'],
      maxWorkers: 1,
    });
    expect(registry.getAgent('test-agent')?.name).toBe('Test Agent');
  });

  it('should unregister agent', () => {
    registry.unregister('opencode');
    expect(registry.getAgent('opencode')).toBeNull();
  });

  it('should return null for unknown agent', () => {
    expect(registry.getAgent('unknown')).toBeNull();
  });
});