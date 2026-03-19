import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempProject, cleanupTempProject, createTestBrain } from './helpers/fixture';
import { startWebServer, stopWebServer, WebServerContext } from './helpers/web-server';
import { createLogger, clearGlobalLogs, getGlobalLogs, LogEntry } from '@agent-orchestrator/core';
import { TempProject } from './helpers/fixture';

describe('Layer 3: Web API Tests', () => {
  let tempProject: TempProject;
  let webContext: WebServerContext;

  beforeEach(async () => {
    tempProject = await createTempProject('layer3-web');
    await createTestBrain(tempProject.dir, {
      name: 'Layer 3 Test Project',
      goal: 'Test web API functionality'
    });
    clearGlobalLogs();
  });

  afterEach(async () => {
    if (webContext) {
      await stopWebServer(webContext);
    }
    await cleanupTempProject(tempProject);
  });

  describe('L3-01-L3-04: Tasks API', () => {
    beforeEach(async () => {
      webContext = await startWebServer(tempProject.dir);
    });

    afterEach(async () => {
      await stopWebServer(webContext);
    });

    it('L3-01: GET /api/tasks should return tasks list', async () => {
      const res = await fetch(`${webContext.baseUrl}/api/tasks`);
      expect(res.status).toBe(200);
      const tasks = await res.json();
      expect(Array.isArray(tasks)).toBe(true);
    });

    it('L3-02: POST /api/tasks should create a new task', async () => {
      const newTask = {
        id: 'WEB-001',
        title: 'Test Task from API',
        description: 'Created via POST request',
        type: 'task' as const,
        status: 'pending' as const
      };

      const res = await fetch(`${webContext.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      });

      expect(res.status).toBe(201);
      const createdTask = await res.json();
      expect(createdTask.id).toBe('WEB-001');
      expect(createdTask.title).toBe('Test Task from API');
      expect(createdTask.status).toBe('pending');

      const listRes = await fetch(`${webContext.baseUrl}/api/tasks`);
      const tasks = await listRes.json();
      expect(tasks.some((t: { id: string }) => t.id === 'WEB-001')).toBe(true);
    });

    it('L3-03: GET /api/tasks/:id should return a specific task', async () => {
      const newTask = {
        id: 'WEB-002',
        title: 'Task to Fetch',
        description: 'Will be fetched by ID',
        type: 'task' as const,
        status: 'pending' as const
      };

      await fetch(`${webContext.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      });

      const res = await fetch(`${webContext.baseUrl}/api/tasks/WEB-002`);
      expect(res.status).toBe(200);
      const task = await res.json();
      expect(task.id).toBe('WEB-002');
      expect(task.title).toBe('Task to Fetch');
    });

    it('L3-04: PUT /api/tasks/:id/status should update task status', async () => {
      const newTask = {
        id: 'WEB-003',
        title: 'Task to Update',
        description: 'Status will be updated',
        type: 'task' as const,
        status: 'pending' as const
      };

      await fetch(`${webContext.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      });

      const res = await fetch(`${webContext.baseUrl}/api/tasks/WEB-003/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'executing',
          changedBy: 'test-agent',
          reason: 'Starting work'
        })
      });

      expect(res.status).toBe(200);
      const updatedTask = await res.json();
      expect(updatedTask.status).toBe('executing');
      expect(updatedTask.statusHistory.length).toBeGreaterThan(0);
      expect(updatedTask.statusHistory[updatedTask.statusHistory.length - 1].status).toBe('executing');
    });
  });

  describe('L3-05-L3-06: Agents and Status API', () => {
    beforeEach(async () => {
      webContext = await startWebServer(tempProject.dir);
    });

    afterEach(async () => {
      await stopWebServer(webContext);
    });

    it('L3-05: GET /api/agents should return agents list', async () => {
      const res = await fetch(`${webContext.baseUrl}/api/agents`);
      expect(res.status).toBe(200);
      const agents = await res.json();
      expect(Array.isArray(agents)).toBe(true);
    });

    it('L3-05: POST /api/agents should create a new agent', async () => {
      const newAgent = {
        id: 'agent-web-001',
        name: 'Web Test Agent',
        description: 'Agent created via API',
        skills: [{ id: 'test-skill', name: 'Testing', tags: ['test'] }],
        workingDirectory: tempProject.dir,
        status: 'online' as const
      };

      const res = await fetch(`${webContext.baseUrl}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent)
      });

      expect(res.status).toBe(201);
      const createdAgent = await res.json();
      expect(createdAgent.id).toBe('agent-web-001');
      expect(createdAgent.name).toBe('Web Test Agent');
      expect(createdAgent.status).toBe('online');
    });

    it('L3-05: GET /api/agents/:id should return a specific agent', async () => {
      const newAgent = {
        id: 'agent-web-002',
        name: 'Agent to Fetch',
        description: 'Will be fetched by ID',
        skills: [],
        workingDirectory: tempProject.dir,
        status: 'offline' as const
      };

      await fetch(`${webContext.baseUrl}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent)
      });

      const res = await fetch(`${webContext.baseUrl}/api/agents/agent-web-002`);
      expect(res.status).toBe(200);
      const agent = await res.json();
      expect(agent.id).toBe('agent-web-002');
      expect(agent.name).toBe('Agent to Fetch');
    });

    it('L3-05: DELETE /api/agents/:id should remove an agent', async () => {
      const newAgent = {
        id: 'agent-web-003',
        name: 'Agent to Delete',
        description: 'Will be deleted',
        skills: [],
        workingDirectory: tempProject.dir,
        status: 'offline' as const
      };

      await fetch(`${webContext.baseUrl}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent)
      });

      const deleteRes = await fetch(`${webContext.baseUrl}/api/agents/agent-web-003`, {
        method: 'DELETE'
      });
      expect(deleteRes.status).toBe(204);

      const getRes = await fetch(`${webContext.baseUrl}/api/agents/agent-web-003`);
      expect(getRes.status).toBe(404);
    });

    it('L3-06: GET /api/status should return project status', async () => {
      const res = await fetch(`${webContext.baseUrl}/api/status`);
      expect(res.status).toBe(200);
      const status = await res.json();
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('agents');
      expect(status).toHaveProperty('tasks');
      expect(status).toHaveProperty('locks');
      expect(status).toHaveProperty('project');
      expect(status.project).toHaveProperty('name');
    });
  });

  describe('L3-07-L3-08: SSE Logs', () => {
    beforeEach(async () => {
      webContext = await startWebServer(tempProject.dir);
      clearGlobalLogs();
    });

    afterEach(async () => {
      await stopWebServer(webContext);
    });

    it('L3-07: GET /api/logs/stream should establish SSE connection', async () => {
      const res = await fetch(`${webContext.baseUrl}/api/logs/stream`, {
        headers: { 'Accept': 'text/event-stream' }
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      expect(res.headers.get('cache-control')).toBe('no-cache');

      const reader = res.body?.getReader();
      expect(reader).toBeDefined();
      reader?.cancel();
    });

    it('L3-08: SSE /api/logs/stream should receive log events', async () => {
      const logger = createLogger('sse-test');
      
      const res = await fetch(`${webContext.baseUrl}/api/logs/stream`, {
        headers: { 'Accept': 'text/event-stream' }
      });

      expect(res.status).toBe(200);

      logger.info('Test log message for SSE', { agentId: 'sse-agent' });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      
      const { value } = await reader!.read();
      const text = decoder.decode(value);
      
      expect(text).toContain(': connected');

      await new Promise(resolve => setTimeout(resolve, 1100));

      const logs = getGlobalLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((l: LogEntry) => l.message === 'Test log message for SSE')).toBe(true);

      reader?.cancel();
    });

    it('L3-08: GET /api/logs should return JSON logs with filters', async () => {
      const logger = createLogger('json-logs-test');
      logger.info('Info message', { agentId: 'agent-1' });
      logger.error('Error message', { taskId: 'task-1' });

      await new Promise(resolve => setTimeout(resolve, 100));

      const allRes = await fetch(`${webContext.baseUrl}/api/logs`);
      expect(allRes.status).toBe(200);
      const allLogs = await allRes.json();
      expect(Array.isArray(allLogs)).toBe(true);

      const errorRes = await fetch(`${webContext.baseUrl}/api/logs?level=error`);
      expect(errorRes.status).toBe(200);
      const errorLogs = await errorRes.json();
      expect(errorLogs.every((l: { level: string }) => l.level === 'error')).toBe(true);

      const agentRes = await fetch(`${webContext.baseUrl}/api/logs?agentId=agent-1`);
      expect(agentRes.status).toBe(200);
      const agentLogs = await agentRes.json();
      expect(agentLogs.every((l: { agentId: string }) => l.agentId === 'agent-1')).toBe(true);
    });
  });

  describe('L3-09-L3-10: Error Handling', () => {
    beforeEach(async () => {
      webContext = await startWebServer(tempProject.dir);
    });

    afterEach(async () => {
      await stopWebServer(webContext);
    });

    it('L3-09: GET /api/tasks/:id should return 404 for non-existent task', async () => {
      const res = await fetch(`${webContext.baseUrl}/api/tasks/non-existent-task`);
      expect(res.status).toBe(404);
      const error = await res.json();
      expect(error).toHaveProperty('error');
      expect(error.error).toContain('not found');
    });

    it('L3-09: GET /api/agents/:id should return 404 for non-existent agent', async () => {
      const res = await fetch(`${webContext.baseUrl}/api/agents/non-existent-agent`);
      expect(res.status).toBe(404);
      const error = await res.json();
      expect(error).toHaveProperty('error');
      expect(error.error).toContain('not found');
    });

    it('L3-10: POST /api/tasks should return 400 for missing required fields', async () => {
      const res = await fetch(`${webContext.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Missing id and title' })
      });

      expect(res.status).toBe(400);
      const error = await res.json();
      expect(error).toHaveProperty('error');
      expect(error.error).toContain('required');
    });

    it('L3-10: POST /api/agents should return 400 for missing required fields', async () => {
      const res = await fetch(`${webContext.baseUrl}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Missing id and name' })
      });

      expect(res.status).toBe(400);
      const error = await res.json();
      expect(error).toHaveProperty('error');
      expect(error.error).toContain('required');
    });

    it('L3-10: PUT /api/tasks/:id/status should return 400 for missing fields', async () => {
      const newTask = {
        id: 'WEB-ERROR-001',
        title: 'Task for error test',
        type: 'task' as const,
        status: 'pending' as const
      };

      await fetch(`${webContext.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      });

      const res = await fetch(`${webContext.baseUrl}/api/tasks/WEB-ERROR-001/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Missing status and changedBy' })
      });

      expect(res.status).toBe(400);
      const error = await res.json();
      expect(error).toHaveProperty('error');
      expect(error.error).toContain('required');
    });

    it('L3-10: PUT /api/tasks/:id/status should return 404 for non-existent task', async () => {
      const res = await fetch(`${webContext.baseUrl}/api/tasks/non-existent/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'executing',
          changedBy: 'test-agent'
        })
      });

      expect(res.status).toBe(404);
      const error = await res.json();
      expect(error).toHaveProperty('error');
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      webContext = await startWebServer(tempProject.dir);
    });

    afterEach(async () => {
      await stopWebServer(webContext);
    });

    it('should return health status', async () => {
      const res = await fetch(`${webContext.baseUrl}/api/health`);
      expect(res.status).toBe(200);
      const health = await res.json();
      expect(health.status).toBe('ok');
      expect(health).toHaveProperty('timestamp');
    });
  });
});