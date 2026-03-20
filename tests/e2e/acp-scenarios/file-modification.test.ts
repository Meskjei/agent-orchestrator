import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createACPTestProject, createTestFile } from '../helpers/acp-runner';

describe('ACP E2E: File Modification', () => {
  let project: Awaited<ReturnType<typeof createACPTestProject>>;

  beforeEach(async () => {
    project = await createACPTestProject('file-mod');
  });

  afterEach(async () => {
    await project.cleanup();
  });

  it('should modify existing file', async () => {
    const mathFile = await createTestFile(
      project.dir,
      'math.js',
      'function add(a, b) { return a + b; }\n'
    );

    const result = await project.adapter.execute({
      task: 'Add a multiply function to math.js that returns a * b.',
      context: {}
    });

    expect(result.error).toBeUndefined();

    const content = await fs.readFile(mathFile, 'utf-8');
    expect(content).toContain('multiply');
  });

  it('should create new file', async () => {
    const result = await project.adapter.execute({
      task: 'Create a file called hello.txt with content "Hello, World!"',
      context: {}
    });

    expect(result.error).toBeUndefined();

    const content = await fs.readFile(path.join(project.dir, 'hello.txt'), 'utf-8');
    expect(content).toContain('Hello');
  });

  it('should handle lock protocol in prompt', async () => {
    await createTestFile(project.dir, 'test.js', 'const x = 1;\n');

    const result = await project.adapter.execute({
      task: 'Add a comment to test.js',
      context: {}
    });

    expect(result.toolCalls).toBeDefined();
  });
});