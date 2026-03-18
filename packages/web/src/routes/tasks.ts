import { Router, Request, Response } from 'express';
import { ProjectBrainImpl, TaskNode } from '@agent-orchestrator/core';

export function createTasksRouter(brain: ProjectBrainImpl): Router {
  const router = Router();
  
  router.get('/', (_req: Request, res: Response) => {
    const tasks = Array.from(brain.tasks.nodes.values());
    res.json(tasks);
  });
  
  router.get('/:id', (req: Request, res: Response) => {
    const task = brain.tasks.nodes.get(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  });
  
  router.post('/', (req: Request, res: Response) => {
    const taskData = req.body as Partial<TaskNode>;
    
    if (!taskData.id || !taskData.title) {
      return res.status(400).json({ error: 'Task id and title are required' });
    }
    
    const task: TaskNode = {
      id: taskData.id,
      parentId: taskData.parentId,
      title: taskData.title,
      description: taskData.description || '',
      type: taskData.type || 'task',
      status: taskData.status || 'pending',
      statusHistory: [{
        status: taskData.status || 'pending',
        changedAt: new Date(),
        changedBy: 'system'
      }],
      dependencies: taskData.dependencies || [],
      estimatedFiles: taskData.estimatedFiles || [],
      children: taskData.children || [],
      expectedOutput: taskData.expectedOutput || {
        type: 'code',
        description: '',
        acceptanceCriteria: []
      }
    };
    
    brain.addTask(task);
    res.status(201).json(task);
  });
  
  router.put('/:id/status', (req: Request, res: Response) => {
    const { status, changedBy, reason } = req.body;
    
    if (!status || !changedBy) {
      return res.status(400).json({ error: 'status and changedBy are required' });
    }
    
    const task = brain.tasks.nodes.get(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    brain.updateTaskStatus(req.params.id, status, changedBy, reason);
    res.json(brain.tasks.nodes.get(req.params.id));
  });
  
  return router;
}