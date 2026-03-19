import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { ProjectBrainImpl, TaskNode, AgentRole } from '@agent-orchestrator/core';
import { createTasksRouter } from './routes/tasks';
import { createAgentsRouter } from './routes/agents';
import { createStatusRouter } from './routes/status';
import { createLogsRouter } from './routes/logs';

export interface ServerContext {
  brain: ProjectBrainImpl;
}

export function createServer(context?: ServerContext): Express {
  const app = express();
  
  const brain = context?.brain || new ProjectBrainImpl(process.cwd());
  
  app.use(cors());
  app.use(express.json());
  
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  app.use('/api/tasks', createTasksRouter(brain));
  app.use('/api/agents', createAgentsRouter(brain));
  app.use('/api/status', createStatusRouter(brain));
  app.use('/api/logs', createLogsRouter(brain));
  
  const publicPath = path.join(__dirname, 'public');
  app.use(express.static(publicPath));
  
  app.get('/', (_req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
  
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  });
  
  return app;
}

export { ProjectBrainImpl } from '@agent-orchestrator/core';
export type { TaskNode, AgentRole } from '@agent-orchestrator/core';