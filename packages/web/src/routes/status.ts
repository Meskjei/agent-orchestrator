import { Router, Request, Response } from 'express';
import { ProjectBrainImpl } from '@agent-orchestrator/core';

export function createStatusRouter(brain: ProjectBrainImpl): Router {
  const router = Router();
  
  router.get('/', (_req: Request, res: Response) => {
    const status = {
      status: 'running',
      agents: brain.agents.length,
      tasks: brain.tasks.nodes.size,
      locks: brain.locks.active.length,
      project: {
        id: brain.id,
        name: brain.name,
        version: brain.version
      }
    };
    res.json(status);
  });
  
  return router;
}