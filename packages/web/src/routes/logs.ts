import { Router, Request, Response } from 'express';
import { ProjectBrainImpl, getGlobalLogs, LogEntry, LogLevel, LogFilter } from '@agent-orchestrator/core';

export function createLogsRouter(brain: ProjectBrainImpl): Router {
  const router = Router();
  
  router.get('/', (req: Request, res: Response) => {
    const { level, agentId, taskId, since, until } = req.query;
    
    const filter: LogFilter = {};
    
    if (level && typeof level === 'string' && ['debug', 'info', 'warn', 'error'].includes(level)) {
      filter.level = level as LogLevel;
    }
    if (agentId && typeof agentId === 'string') {
      filter.agentId = agentId;
    }
    if (taskId && typeof taskId === 'string') {
      filter.taskId = taskId;
    }
    if (since && typeof since === 'string') {
      filter.since = new Date(since);
    }
    if (until && typeof until === 'string') {
      filter.until = new Date(until);
    }
    
    const logs = getGlobalLogs(filter);
    res.json(logs);
  });
  
  router.get('/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    res.flushHeaders();
    
    res.write(': connected\n\n');
    
    let lastTimestamp = new Date();
    
    const interval = setInterval(() => {
      try {
        const logs = getGlobalLogs({ since: lastTimestamp });
        
        for (const log of logs) {
          if (log.timestamp > lastTimestamp) {
            lastTimestamp = log.timestamp;
          }
          res.write(`data: ${JSON.stringify(log)}\n\n`);
        }
      } catch (err) {
        console.error('Error streaming logs:', err);
      }
    }, 1000);
    
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15000);
    
    req.on('close', () => {
      clearInterval(interval);
      clearInterval(keepAlive);
    });
    
    req.on('error', (err) => {
      console.error('SSE error:', err);
      clearInterval(interval);
      clearInterval(keepAlive);
    });
  });
  
  router.get('/recent', (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = getGlobalLogs();
    const recentLogs = logs.slice(-limit);
    res.json(recentLogs);
  });
  
  return router;
}