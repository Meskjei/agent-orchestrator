import { describe, it, expect } from 'vitest';
import { createBrain } from '../brain.js';
import { ACPGateway } from '@agent-orchestrator/acp';

describe('Mastra Brain', () => {
  it('should create brain with gateway', () => {
    const brain = createBrain({
      llm: { provider: 'openai', model: 'gpt-4o' },
      maxConcurrentTasks: 3,
    });

    expect(brain.agent).toBeDefined();
    expect(brain.gateway).toBeDefined();
  });

  it('should have ACP tools registered', () => {
    const brain = createBrain({
      llm: { provider: 'openai', model: 'gpt-4o' },
      maxConcurrentTasks: 3,
    });

    const agents = brain.gateway.listAgents();
    expect(agents.length).toBeGreaterThan(0);
    expect(agents.map(a => a.id)).toContain('opencode');
    expect(agents.map(a => a.id)).toContain('claude');
  });

  it('should dispatch to gateway', async () => {
    const brain = createBrain({
      llm: { provider: 'openai', model: 'gpt-4o' },
      maxConcurrentTasks: 3,
    });

    const result = await brain.gateway.dispatch({
      agentId: 'nonexistent',
      prompt: 'test',
      cwd: '/tmp',
    });

    expect(result.error).toContain('Agent not found');
  });

  it('should query locks through gateway', () => {
    const brain = createBrain({
      llm: { provider: 'openai', model: 'gpt-4o' },
      maxConcurrentTasks: 3,
    });

    const locks = brain.gateway.queryLock(['a.ts', 'b.ts']);
    expect(locks).toHaveLength(2);
    expect(locks[0].locked).toBe(false);
  });
});