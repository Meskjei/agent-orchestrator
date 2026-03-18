import { ProjectBrainImpl } from '@agent-orchestrator/core';

interface TaskConfig {
  title: string;
  description: string;
  type: 'code' | 'document' | 'analysis' | 'decision';
  acceptanceCriteria: string[];
}

export async function createTaskCommand(brain: ProjectBrainImpl, taskConfig?: Partial<TaskConfig>): Promise<string> {
  const config: TaskConfig = {
    title: taskConfig?.title || 'New Task',
    description: taskConfig?.description || 'Task description',
    type: taskConfig?.type || 'code',
    acceptanceCriteria: taskConfig?.acceptanceCriteria || []
  };

  const taskId = `T${String(brain.tasks.nodes.size + 1).padStart(3, '0')}`;
  
  const taskNode = {
    id: taskId,
    title: config.title,
    description: config.description,
    type: 'task' as const,
    expectedOutput: {
      type: config.type,
      description: config.description,
      acceptanceCriteria: config.acceptanceCriteria
    },
    status: 'pending' as const,
    statusHistory: [{
      status: 'pending' as const,
      changedAt: new Date(),
      changedBy: 'cli'
    }],
    dependencies: [],
    estimatedFiles: [],
    children: []
  };

  brain.addTask(taskNode);
  await brain.save();
  
  console.log(`✓ Task ${taskId} created: ${config.title}`);
  return taskId;
}