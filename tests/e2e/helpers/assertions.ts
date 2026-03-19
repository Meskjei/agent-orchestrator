import * as fs from 'fs/promises';
import * as path from 'path';
import { expect } from 'vitest';
import { ProjectBrainImpl } from '@agent-orchestrator/core/brain/brain';
import { LockManager } from '@agent-orchestrator/core/lock/manager';
import { TaskNode, TaskStatus } from '@agent-orchestrator/core/types';

export async function assertBrainPersisted(
  dir: string,
  expected: {
    name?: string;
    agentCount?: number;
    taskCount?: number;
  }
): Promise<void> {
  const brain = new ProjectBrainImpl(dir);
  const loaded = await brain.load();
  
  expect(loaded).toBe(true);
  
  if (expected.name !== undefined) {
    expect(brain.name).toBe(expected.name);
  }
  if (expected.agentCount !== undefined) {
    expect(brain.agents.length).toBe(expected.agentCount);
  }
  if (expected.taskCount !== undefined) {
    expect(brain.tasks.nodes.size).toBe(expected.taskCount);
  }
}

export async function assertDirectoryStructure(
  dir: string,
  expectedFiles: string[]
): Promise<void> {
  for (const file of expectedFiles) {
    const fullPath = path.join(dir, file);
    await expect(fs.access(fullPath)).resolves.toBeUndefined();
  }
}

export function assertLockStatus(
  lockManager: LockManager,
  file: string,
  expected: { locked: boolean; holder?: string }
): void {
  const status = lockManager.getLockStatus(file);
  
  expect(status.locked).toBe(expected.locked);
  
  if (expected.holder !== undefined) {
    expect(status.holder).toBe(expected.holder);
  }
}

export function assertTaskStatusHistory(
  task: TaskNode,
  expectedStatuses: TaskStatus[]
): void {
  expect(task.statusHistory.length).toBe(expectedStatuses.length);
  
  for (let i = 0; i < expectedStatuses.length; i++) {
    expect(task.statusHistory[i].status).toBe(expectedStatuses[i]);
  }
}

export async function assertFileContains(
  filePath: string,
  expectedContent: string
): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');
  expect(content).toContain(expectedContent);
}