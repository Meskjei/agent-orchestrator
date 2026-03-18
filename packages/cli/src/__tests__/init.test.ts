import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initCommand } from '../commands/init';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('init command', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should create .agent-orch directory', async () => {
    await initCommand(tempDir, {
      name: 'Test Project',
      description: 'Test description',
      goal: 'Test goal'
    });
    
    const configPath = path.join(tempDir, '.agent-orch', 'config.yaml');
    const brainPath = path.join(tempDir, '.agent-orch', 'brain.json');
    
    await expect(fs.access(configPath)).resolves.toBeUndefined();
    await expect(fs.access(brainPath)).resolves.toBeUndefined();
  });
});