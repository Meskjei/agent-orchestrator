import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createACPTestProject, createTestFile } from '../helpers/acp-runner';
import { ACPClientAdapter, ACPConnectionPool } from '@agent-orchestrator/adapter';

describe('ACP E2E: Concurrent and Error Recovery', () => {
  let project: Awaited<ReturnType<typeof createACPTestProject>>;

  beforeEach(async () => {
    project = await createACPTestProject('concurrent');
  });

  afterEach(async () => {
    await project.cleanup();
  });

  describe('Concurrent Agents', () => {
    it('should handle two agents working on different files', async () => {
      const file1 = await createTestFile(project.dir, 'file1.ts', 'const a = 1;\n');
      const file2 = await createTestFile(project.dir, 'file2.ts', 'const b = 2;\n');

      const pool = new ACPConnectionPool();
      const adapter1 = new ACPClientAdapter({
        name: 'agent1',
        command: 'opencode',
        args: ['acp'],
        cwd: project.dir,
        timeout: 60000
      }, pool);

      const adapter2 = new ACPClientAdapter({
        name: 'agent2',
        command: 'opencode',
        args: ['acp'],
        cwd: project.dir,
        timeout: 60000
      }, pool);

      const [result1, result2] = await Promise.all([
        adapter1.execute({ task: 'Add a comment to file1.ts', context: {} }),
        adapter2.execute({ task: 'Add a comment to file2.ts', context: {} })
      ]);

      expect(result1.error).toBeUndefined();
      expect(result2.error).toBeUndefined();

      const content1 = await fs.readFile(file1, 'utf-8');
      const content2 = await fs.readFile(file2, 'utf-8');
      expect(content1.length).toBeGreaterThan(10);
      expect(content2.length).toBeGreaterThan(10);

      await pool.closeAll();
    });
  });

  describe('Error Recovery', () => {
    it('should handle invalid command gracefully', async () => {
      const adapter = new ACPClientAdapter({
        name: 'error-test',
        command: 'opencode',
        args: ['invalid-arg-that-does-not-exist'],
        cwd: project.dir,
        timeout: 10000
      });

      const result = await adapter.execute({
        task: 'This should fail',
        context: {}
      });

      expect(result.error).toBeDefined();
    }, 30000);

    it('should allow cancel after execution', async () => {
      const adapter = new ACPClientAdapter({
        name: 'cancel-test',
        command: 'opencode',
        args: ['acp'],
        cwd: project.dir,
        timeout: 90000
      });

      await adapter.execute({
        task: 'Say hello',
        context: {}
      });

      await expect(adapter.cancel()).resolves.not.toThrow();
    });
  });
});