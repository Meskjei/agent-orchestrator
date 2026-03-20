import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createACPTestProject } from '../helpers/acp-runner';

describe('ACP E2E: Simple Tasks', () => {
  let project: Awaited<ReturnType<typeof createACPTestProject>>;

  beforeEach(async () => {
    project = await createACPTestProject('simple');
  });

  afterEach(async () => {
    await project.cleanup();
  });

  it('should execute simple question and return answer', async () => {
    const result = await project.adapter.execute({
      task: 'What is 2+2? Answer with just the number.',
      context: {}
    });

    expect(result.error).toBeUndefined();
    expect(result.output).toContain('4');
  });

  it('should check agent status', async () => {
    const status = await project.adapter.getStatus();
    expect(status.online).toBe(true);
  });

  it('should handle timeout gracefully', async () => {
    const { ACPClientAdapter } = await import('@agent-orchestrator/adapter');
    const slowAdapter = new ACPClientAdapter({
      name: 'opencode',
      command: 'opencode',
      args: ['acp'],
      cwd: project.dir,
      timeout: 5000
    });

    const result = await slowAdapter.execute({
      task: 'Write a complete sorting algorithm implementation with tests',
      context: {}
    });

    expect(result.error).toBeDefined();
  }, 30000);
});