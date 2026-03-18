import { describe, it, expect, vi } from 'vitest';
import { CliAdapter } from '../cli-adapter';

describe('CliAdapter', () => {
  it('should execute CLI command and return output', async () => {
    const adapter = new CliAdapter({
      name: 'test-agent',
      command: 'echo',
      args: ['hello'],
      cwd: process.cwd()
    });

    const result = await adapter.execute({ task: 'test task', context: {} });
    
    expect(result.output).toContain('hello');
  });

  it('should apply input transform', async () => {
    const adapter = new CliAdapter({
      name: 'test-agent',
      command: 'cat',
      args: [],
      cwd: process.cwd(),
      inputTemplate: 'Task: {{task}}'
    });

    const result = await adapter.execute({ task: 'my-task', context: {} });
    expect(result.output).toBeDefined();
  });
});