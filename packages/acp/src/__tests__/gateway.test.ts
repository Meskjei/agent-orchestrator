import { describe, it, expect } from 'vitest';
import { ACPGateway } from '../gateway.js';

describe('ACPGateway', () => {
  it('should list registered agents', () => {
    const gateway = new ACPGateway();
    const agents = gateway.listAgents();
    expect(agents.length).toBeGreaterThan(0);
  });

  it('should register custom agent', () => {
    const gateway = new ACPGateway();
    gateway.registerAgent({
      id: 'custom',
      name: 'Custom Agent',
      command: 'custom-cli',
      args: ['acp'],
      capabilities: ['python'],
      maxWorkers: 1,
    });
    expect(gateway.listAgents().map((a) => a.id)).toContain('custom');
  });

  it('should query lock status', () => {
    const gateway = new ACPGateway();
    const locks = gateway.queryLock(['a.ts']);
    expect(locks[0].locked).toBe(false);
  });

  it('should return error for unknown agent dispatch', async () => {
    const gateway = new ACPGateway();
    const result = await gateway.dispatch({
      agentId: 'nonexistent',
      prompt: 'test',
      cwd: '/tmp',
    });
    expect(result.error).toContain('Agent not found');
  });
});