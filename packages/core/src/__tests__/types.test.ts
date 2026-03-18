import { describe, it, expect } from 'vitest';

describe('Core Types', () => {
  it('should export TaskNode type', () => {
    const task: import('../types').TaskNode = {
      id: 'T001',
      title: 'Test Task',
      description: 'Test description',
      type: 'task',
      status: 'pending',
      expectedOutput: {
        type: 'code',
        description: 'Test output',
        acceptanceCriteria: []
      },
      estimatedFiles: [],
      children: [],
      dependencies: [],
      statusHistory: []
    };
    expect(task.id).toBe('T001');
  });
});