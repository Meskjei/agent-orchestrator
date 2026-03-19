import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ProjectBrainImpl } from '@agent-orchestrator/core/brain/brain';

export interface TempProject {
  dir: string;
  brainPath: string;
  configPath: string;
}

export async function createTempProject(name: string = 'test-project'): Promise<TempProject> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `agent-orch-${name}-`));
  return {
    dir,
    brainPath: path.join(dir, '.agent-orch', 'brain.json'),
    configPath: path.join(dir, '.agent-orch', 'config.yaml')
  };
}

export async function cleanupTempProject(project: TempProject): Promise<void> {
  await fs.rm(project.dir, { recursive: true, force: true });
}

export async function createTestBrain(
  dir: string,
  options?: {
    name?: string;
    goal?: string;
    successCriteria?: string[];
    constraints?: string[];
  }
): Promise<ProjectBrainImpl> {
  const brain = new ProjectBrainImpl(dir, {
    name: options?.name || 'Test Project',
    version: '1.0.0',
    goal: {
      description: options?.goal || 'Test goal',
      successCriteria: options?.successCriteria || [],
      constraints: options?.constraints || []
    }
  });
  await brain.save();
  return brain;
}

export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options?: { timeout?: number; interval?: number }
): Promise<void> {
  const timeout = options?.timeout || 5000;
  const interval = options?.interval || 100;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}