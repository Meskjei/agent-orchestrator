import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createServer } from '../server';

describe('API Routes', () => {
  it('GET /api/health should return ok', async () => {
    const app = createServer();
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/status should return project status', async () => {
    const app = createServer();
    const res = await request(app).get('/api/status');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('agents');
    expect(res.body).toHaveProperty('tasks');
  });

  it('GET /api/tasks should return tasks list', async () => {
    const app = createServer();
    const res = await request(app).get('/api/tasks');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/agents should return agents list', async () => {
    const app = createServer();
    const res = await request(app).get('/api/agents');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});