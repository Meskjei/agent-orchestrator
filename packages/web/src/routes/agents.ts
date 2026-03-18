import { Router, Request, Response } from 'express';
import { ProjectBrainImpl, AgentRole } from '@agent-orchestrator/core';

export function createAgentsRouter(brain: ProjectBrainImpl): Router {
  const router = Router();
  
  router.get('/', (_req: Request, res: Response) => {
    res.json(brain.agents);
  });
  
  router.get('/:id', (req: Request, res: Response) => {
    const agent = brain.getAgent(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json(agent);
  });
  
  router.post('/', (req: Request, res: Response) => {
    const agentData = req.body as Partial<AgentRole>;
    
    if (!agentData.id || !agentData.name) {
      return res.status(400).json({ error: 'Agent id and name are required' });
    }
    
    const agent: AgentRole = {
      id: agentData.id,
      name: agentData.name,
      description: agentData.description || '',
      skills: agentData.skills || [],
      workingDirectory: agentData.workingDirectory || process.cwd(),
      endpoint: agentData.endpoint,
      status: agentData.status || 'offline',
      currentTask: agentData.currentTask
    };
    
    brain.addAgent(agent);
    res.status(201).json(agent);
  });
  
  router.delete('/:id', (req: Request, res: Response) => {
    const index = brain.agents.findIndex(a => a.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    brain.agents.splice(index, 1);
    res.status(204).send();
  });
  
  return router;
}