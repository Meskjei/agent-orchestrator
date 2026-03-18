import { describe, it, expect } from 'vitest';
import { AgentDispatchSkill } from '../agent-dispatch';
import { LockManager } from '@agent-orchestrator/core';
import { CliAdapter, AdapterContext } from '@agent-orchestrator/adapter';

describe('AgentDispatchSkill', () => {
  it('should dispatch task to agent', async () => {
    const lockManager = new LockManager();
    const adapter = new CliAdapter({
      name: 'test-agent',
      command: 'echo',
      args: ['done'],
      cwd: process.cwd()
    });

    const skill = new AgentDispatchSkill(lockManager, { 'test-agent': adapter });

    const result = await skill.execute({
      agentId: 'test-agent',
      task: {
        id: 'T001',
        title: 'Test task',
        description: 'Test description',
        type: 'task',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: ['file1.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      context: {
        projectGoal: 'Test project',
        agentRole: 'developer',
        relevantCodeSnippets: [],
        relatedOutputs: [],
        currentLocks: []
      }
    });

    expect(result.status).toBe('completed');
    expect(result.output.summary).toContain('done');
  });

  it('should return failed status when adapter not found', async () => {
    const lockManager = new LockManager();
    const skill = new AgentDispatchSkill(lockManager, {});

    const result = await skill.execute({
      agentId: 'non-existent',
      task: {
        id: 'T001',
        title: 'Test task',
        description: 'Test description',
        type: 'task',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: [],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      context: {
        projectGoal: 'Test project',
        agentRole: 'developer',
        relevantCodeSnippets: [],
        relatedOutputs: [],
        currentLocks: []
      }
    });

    expect(result.status).toBe('failed');
    expect(result.output.summary).toContain('No adapter found');
  });

  it('should return blocked status when lock denied', async () => {
    const lockManager = new LockManager();
    
    await lockManager.acquireLock({
      agentId: 'other-agent',
      taskId: 'OTHER_TASK',
      files: ['file1.ts'],
      granularity: 'file',
      type: 'exclusive'
    });

    const adapter = new CliAdapter({
      name: 'test-agent',
      command: 'echo',
      args: ['done'],
      cwd: process.cwd()
    });

    const skill = new AgentDispatchSkill(lockManager, { 'test-agent': adapter });

    const result = await skill.execute({
      agentId: 'test-agent',
      task: {
        id: 'T001',
        title: 'Test task',
        description: 'Test description',
        type: 'task',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: ['file1.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      context: {
        projectGoal: 'Test project',
        agentRole: 'developer',
        relevantCodeSnippets: [],
        relatedOutputs: [],
        currentLocks: []
      }
    });

    expect(result.status).toBe('blocked');
    expect(result.output.summary).toContain('locked');
  });

  it('should acquire and release locks during execution', async () => {
    const lockManager = new LockManager();
    const adapter = new CliAdapter({
      name: 'test-agent',
      command: 'echo',
      args: ['done'],
      cwd: process.cwd()
    });

    const skill = new AgentDispatchSkill(lockManager, { 'test-agent': adapter });

    const result = await skill.execute({
      agentId: 'test-agent',
      task: {
        id: 'T001',
        title: 'Test task',
        description: 'Test description',
        type: 'task',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: ['file1.ts', 'file2.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      context: {
        projectGoal: 'Test project',
        agentRole: 'developer',
        relevantCodeSnippets: [],
        relatedOutputs: [],
        currentLocks: []
      }
    });

    expect(result.status).toBe('completed');
    expect(result.locksAcquired).toHaveLength(1);
    expect(result.locksReleased).toHaveLength(1);
    expect(result.locksAcquired[0]).toBe(result.locksReleased[0]);
  });

  it('should handle adapter execution errors', async () => {
    const lockManager = new LockManager();
    const adapter = new CliAdapter({
      name: 'test-agent',
      command: 'node',
      args: ['-e', 'process.exit(1)'],
      cwd: process.cwd()
    });

    const skill = new AgentDispatchSkill(lockManager, { 'test-agent': adapter });

    const result = await skill.execute({
      agentId: 'test-agent',
      task: {
        id: 'T001',
        title: 'Test task',
        description: 'Test description',
        type: 'task',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: [],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      context: {
        projectGoal: 'Test project',
        agentRole: 'developer',
        relevantCodeSnippets: [],
        relatedOutputs: [],
        currentLocks: []
      }
    });

    expect(result.status).toBe('failed');
  });

  it('should include code snippets in context', async () => {
    const lockManager = new LockManager();
    let capturedContext: AdapterContext | undefined;

    const adapter = {
      config: { name: 'test-agent', command: 'echo', args: [] },
      execute: async (context: AdapterContext) => {
        capturedContext = context;
        return { output: 'done' };
      },
      getStatus: async () => ({ online: true })
    };

    const skill = new AgentDispatchSkill(lockManager, { 'test-agent': adapter as unknown as CliAdapter });

    await skill.execute({
      agentId: 'test-agent',
      task: {
        id: 'T001',
        title: 'Test task',
        description: 'Test description',
        type: 'task',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: [],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      context: {
        projectGoal: 'Test project',
        agentRole: 'developer',
        relevantCodeSnippets: [{ file: 'test.ts', content: 'const x = 1;', language: 'typescript' }],
        relatedOutputs: [],
        currentLocks: []
      }
    });

    expect(capturedContext?.context.codeSnippets).toHaveLength(1);
    expect(capturedContext?.context.codeSnippets?.[0].file).toBe('test.ts');
  });
});