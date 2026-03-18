# Multi-Agent Collaboration System - Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build review and decision system with TaskReviewSkill, DecisionLogSkill, two-stage review process, and basic Web Dashboard.

**Architecture:** Extend orchestrator with review skills, add web package with Express server and basic API.

**Tech Stack:** TypeScript, Express, Zod

---

## File Structure

```
packages/
├── orchestrator/
│   └── src/
│       └── skills/
│           ├── task-review.ts       # NEW: TaskReviewSkill
│           └── decision-log.ts      # NEW: DecisionLogSkill
│
└── web/
    ├── package.json                 # NEW
    ├── tsconfig.json                # NEW
    └── src/
        ├── server.ts                # NEW: Express server
        ├── routes/
        │   ├── tasks.ts             # NEW: Task API routes
        │   ├── agents.ts            # NEW: Agent API routes
        │   └── status.ts            # NEW: Status API routes
        └── index.ts                 # NEW
```

---

## Chunk 1: TaskReviewSkill

### Task 1: TaskReviewSkill Implementation

**Files:**
- Create: `packages/orchestrator/src/skills/task-review.ts`
- Create: `packages/orchestrator/src/skills/__tests__/task-review.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/orchestrator/src/skills/__tests__/task-review.test.ts
import { describe, it, expect } from 'vitest';
import { TaskReviewSkill } from '../task-review';

describe('TaskReviewSkill', () => {
  it('should review spec compliance', async () => {
    const skill = new TaskReviewSkill();

    const result = await skill.execute({
      task: {
        id: 'T001',
        title: 'Implement feature',
        description: 'Add user authentication',
        type: 'task',
        status: 'reviewing',
        expectedOutput: {
          type: 'code',
          description: 'Auth module',
          acceptanceCriteria: ['Login works', 'Logout works']
        },
        estimatedFiles: ['auth.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      output: {
        summary: 'Implemented auth',
        files: ['auth.ts'],
        artifacts: []
      },
      reviewType: 'spec'
    });

    expect(result.passed).toBeDefined();
    expect(result.specReview).toBeDefined();
  });

  it('should detect missing acceptance criteria', async () => {
    const skill = new TaskReviewSkill();

    const result = await skill.execute({
      task: {
        id: 'T001',
        title: 'Test task',
        description: 'Test',
        type: 'task',
        status: 'reviewing',
        expectedOutput: {
          type: 'code',
          description: 'Test output',
          acceptanceCriteria: ['Criteria 1', 'Criteria 2']
        },
        estimatedFiles: [],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      output: {
        summary: 'Only did criteria 1',
        files: [],
        artifacts: []
      },
      reviewType: 'spec'
    });

    // Simple heuristic: if output mentions criteria, mark as done
    expect(result.specReview.missingRequirements).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

```typescript
// packages/orchestrator/src/skills/task-review.ts
import { TaskNode } from '@agent-orchestrator/core/types';

export interface TaskOutput {
  summary: string;
  files: string[];
  artifacts: string[];
}

export interface ReviewInput {
  task: TaskNode;
  output: TaskOutput;
  reviewType: 'spec' | 'quality' | 'both';
}

export interface SpecReviewResult {
  compliant: boolean;
  missingRequirements: string[];
  extraWork: string[];
}

export interface QualityReviewResult {
  approved: boolean;
  strengths: string[];
  issues: Array<{
    severity: 'critical' | 'important' | 'minor';
    description: string;
    file?: string;
  }>;
}

export interface ReviewReport {
  passed: boolean;
  specReview: SpecReviewResult;
  qualityReview?: QualityReviewResult;
  requiresHumanReview: boolean;
}

export class TaskReviewSkill {
  async execute(input: ReviewInput): Promise<ReviewReport> {
    const specReview = this.reviewSpecCompliance(input.task, input.output);
    
    let qualityReview: QualityReviewResult | undefined;
    if (input.reviewType === 'quality' || input.reviewType === 'both') {
      qualityReview = this.reviewCodeQuality(input.output);
    }

    const passed = specReview.compliant && (!qualityReview || qualityReview.approved);
    const requiresHumanReview = !passed || 
      (qualityReview?.issues.some(i => i.severity === 'critical') ?? false);

    return {
      passed,
      specReview,
      qualityReview,
      requiresHumanReview
    };
  }

  private reviewSpecCompliance(task: TaskNode, output: TaskOutput): SpecReviewResult {
    const missingRequirements: string[] = [];
    const extraWork: string[] = [];

    // Check acceptance criteria
    for (const criteria of task.expectedOutput.acceptanceCriteria) {
      const mentioned = output.summary.toLowerCase().includes(criteria.toLowerCase()) ||
        output.files.some(f => f.toLowerCase().includes(criteria.toLowerCase()));
      
      if (!mentioned) {
        missingRequirements.push(criteria);
      }
    }

    // Check if output type matches
    if (task.expectedOutput.type === 'code' && output.files.length === 0) {
      missingRequirements.push('Expected code output but no files provided');
    }

    return {
      compliant: missingRequirements.length === 0,
      missingRequirements,
      extraWork
    };
  }

  private reviewCodeQuality(output: TaskOutput): QualityReviewResult {
    const strengths: string[] = [];
    const issues: Array<{ severity: 'critical' | 'important' | 'minor'; description: string; file?: string }> = [];

    // Basic quality checks
    if (output.files.length > 0) {
      strengths.push('Files were produced');
    }

    if (output.summary.length < 10) {
      issues.push({
        severity: 'minor',
        description: 'Summary is too brief'
      });
    }

    if (output.artifacts.length > 0) {
      strengths.push('Additional artifacts provided');
    }

    return {
      approved: issues.filter(i => i.severity === 'critical').length === 0,
      strengths,
      issues
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/orchestrator/src/skills/task-review.ts
git add packages/orchestrator/src/skills/__tests__/task-review.test.ts
git commit -m "feat(orchestrator): implement TaskReviewSkill"
```

---

## Chunk 2: DecisionLogSkill

### Task 2: DecisionLogSkill Implementation

**Files:**
- Create: `packages/orchestrator/src/skills/decision-log.ts`
- Create: `packages/orchestrator/src/skills/__tests__/decision-log.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/orchestrator/src/skills/__tests__/decision-log.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionLogSkill } from '../decision-log';

describe('DecisionLogSkill', () => {
  let skill: DecisionLogSkill;

  beforeEach(() => {
    skill = new DecisionLogSkill();
  });

  it('should record a decision', async () => {
    const result = await skill.execute({
      action: 'record',
      decision: {
        decision: 'Use TypeScript for new project',
        decider: 'human',
        context: 'Technical stack selection',
        alternatives: ['JavaScript', 'Python'],
        impact: ['All developers need TypeScript knowledge']
      }
    });

    expect(result.success).toBe(true);
    expect(result.decision?.id).toBeDefined();
  });

  it('should list decisions', async () => {
    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision 1',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision 2',
        decider: 'agent-1',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    const result = await skill.execute({ action: 'list' });

    expect(result.decisions?.length).toBe(2);
  });

  it('should filter decisions by decider', async () => {
    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision 1',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision 2',
        decider: 'agent-1',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    const result = await skill.execute({ action: 'list', filters: { decider: 'human' } });

    expect(result.decisions?.length).toBe(1);
    expect(result.decisions?.[0].decider).toBe('human');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

```typescript
// packages/orchestrator/src/skills/decision-log.ts
import { Decision } from '@agent-orchestrator/core/types';

export interface DecisionInput {
  decision: string;
  decider: string;
  context: string;
  alternatives: string[];
  impact: string[];
  relatedTasks?: string[];
  relatedFiles?: string[];
}

export interface DecisionLogInput {
  action: 'record' | 'list' | 'query';
  decision?: DecisionInput;
  filters?: {
    decider?: string;
    since?: Date;
    relatedTo?: string;
  };
}

export interface DecisionLogResult {
  success: boolean;
  decision?: Decision;
  decisions?: Decision[];
}

export class DecisionLogSkill {
  private decisions: Decision[] = [];

  async execute(input: DecisionLogInput): Promise<DecisionLogResult> {
    switch (input.action) {
      case 'record':
        return this.record(input);
      case 'list':
        return this.list(input);
      case 'query':
        return this.query(input);
      default:
        return { success: false };
    }
  }

  private async record(input: DecisionLogInput): Promise<DecisionLogResult> {
    if (!input.decision) {
      return { success: false };
    }

    const decision: Decision = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      decision: input.decision.decision,
      decider: input.decision.decider,
      context: input.decision.context,
      alternatives: input.decision.alternatives,
      impact: input.decision.impact,
      relatedTasks: input.decision.relatedTasks || [],
      relatedFiles: input.decision.relatedFiles || []
    };

    this.decisions.push(decision);

    return { success: true, decision };
  }

  private async list(input: DecisionLogInput): Promise<DecisionLogResult> {
    let result = [...this.decisions];

    if (input.filters?.decider) {
      result = result.filter(d => d.decider === input.filters!.decider);
    }

    if (input.filters?.since) {
      result = result.filter(d => d.timestamp >= input.filters!.since!);
    }

    // Sort by timestamp descending
    result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return { success: true, decisions: result };
  }

  private async query(input: DecisionLogInput): Promise<DecisionLogResult> {
    if (!input.filters?.relatedTo) {
      return this.list(input);
    }

    const related = input.filters.relatedTo;
    const result = this.decisions.filter(d => 
      d.relatedTasks.includes(related) ||
      d.relatedFiles.includes(related) ||
      d.decision.includes(related) ||
      d.context.includes(related)
    );

    return { success: true, decisions: result };
  }

  getAll(): Decision[] {
    return [...this.decisions];
  }

  clear(): void {
    this.decisions = [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/orchestrator/src/skills/decision-log.ts
git add packages/orchestrator/src/skills/__tests__/decision-log.test.ts
git commit -m "feat(orchestrator): implement DecisionLogSkill"
```

---

## Chunk 3: Web Dashboard Package

### Task 3: Web Package Setup

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/src/server.ts`
- Create: `packages/web/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@agent-orchestrator/web",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "@agent-orchestrator/core": "*",
    "@agent-orchestrator/orchestrator": "*",
    "express": "^4.18.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "tsx": "^4.0.0",
    "vitest": "^1.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create server.ts**

```typescript
import express, { Request, Response } from 'express';
import cors from 'cors';

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Status endpoint
  app.get('/api/status', (_req: Request, res: Response) => {
    res.json({
      status: 'running',
      agents: 0,
      tasks: 0,
      locks: 0
    });
  });

  return app;
}

export function startServer(port: number = 3000) {
  const app = createServer();
  
  app.listen(port, () => {
    console.log(`Agent Orchestrator API running on http://localhost:${port}`);
  });

  return app;
}
```

- [ ] **Step 4: Create index.ts**

```typescript
export { createServer, startServer } from './server';
```

- [ ] **Step 5: Install and test**

```bash
npm install
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add packages/web/
git commit -m "feat(web): create web package with Express server"
```

---

## Chunk 4: API Routes

### Task 4: Task and Agent API Routes

**Files:**
- Create: `packages/web/src/routes/tasks.ts`
- Create: `packages/web/src/routes/agents.ts`
- Create: `packages/web/src/routes/status.ts`
- Create: `packages/web/src/__tests__/api.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/web/src/__tests__/api.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - module not found

- [ ] **Step 3: Create routes**

```typescript
// packages/web/src/routes/tasks.ts
import { Router, Request, Response } from 'express';

export function createTasksRouter(): Router {
  const router = Router();

  // In-memory store for MVP
  const tasks: any[] = [];

  router.get('/', (_req: Request, res: Response) => {
    res.json(tasks);
  });

  router.get('/:id', (req: Request, res: Response) => {
    const task = tasks.find(t => t.id === req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  });

  router.post('/', (req: Request, res: Response) => {
    const task = {
      id: `T${String(tasks.length + 1).padStart(3, '0')}`,
      ...req.body,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    tasks.push(task);
    res.status(201).json(task);
  });

  router.put('/:id/status', (req: Request, res: Response) => {
    const task = tasks.find(t => t.id === req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    task.status = req.body.status;
    res.json(task);
  });

  return router;
}
```

```typescript
// packages/web/src/routes/agents.ts
import { Router, Request, Response } from 'express';

export function createAgentsRouter(): Router {
  const router = Router();

  // In-memory store for MVP
  const agents: any[] = [];

  router.get('/', (_req: Request, res: Response) => {
    res.json(agents);
  });

  router.get('/:id', (req: Request, res: Response) => {
    const agent = agents.find(a => a.id === req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json(agent);
  });

  router.post('/', (req: Request, res: Response) => {
    const agent = {
      id: req.body.id || crypto.randomUUID(),
      ...req.body,
      status: 'offline',
      registeredAt: new Date().toISOString()
    };
    agents.push(agent);
    res.status(201).json(agent);
  });

  router.delete('/:id', (req: Request, res: Response) => {
    const index = agents.findIndex(a => a.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    agents.splice(index, 1);
    res.status(204).send();
  });

  return router;
}
```

```typescript
// packages/web/src/routes/status.ts
import { Router, Request, Response } from 'express';

export function createStatusRouter(): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    res.json({
      status: 'running',
      version: '1.0.0',
      uptime: process.uptime(),
      agents: { total: 0, online: 0, busy: 0 },
      tasks: { total: 0, pending: 0, completed: 0 },
      locks: { active: 0 }
    });
  });

  return router;
}
```

- [ ] **Step 4: Update server.ts to use routes**

```typescript
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createTasksRouter } from './routes/tasks';
import { createAgentsRouter } from './routes/agents';
import { createStatusRouter } from './routes/status';

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api/tasks', createTasksRouter());
  app.use('/api/agents', createAgentsRouter());
  app.use('/api/status', createStatusRouter());

  return app;
}

export function startServer(port: number = 3000) {
  const app = createServer();
  
  app.listen(port, () => {
    console.log(`Agent Orchestrator API running on http://localhost:${port}`);
    console.log(`API endpoints:`);
    console.log(`  GET  /api/health`);
    console.log(`  GET  /api/status`);
    console.log(`  GET  /api/tasks`);
    console.log(`  POST /api/tasks`);
    console.log(`  GET  /api/agents`);
    console.log(`  POST /api/agents`);
  });

  return app;
}
```

- [ ] **Step 5: Add supertest to devDependencies**

Update packages/web/package.json:
```json
{
  "devDependencies": {
    "supertest": "^6.3.0",
    "@types/supertest": "^6.0.0"
  }
}
```

- [ ] **Step 6: Run tests**

```bash
npm install
npm test
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/web/
git commit -m "feat(web): add API routes for tasks, agents, and status"
```

---

## Chunk 5: Integration

### Task 5: Update Exports and Final Build

**Files:**
- Modify: `packages/orchestrator/src/index.ts`
- Modify: `packages/web/src/index.ts`

- [ ] **Step 1: Update orchestrator exports**

```typescript
// packages/orchestrator/src/index.ts
export { orchestratorConfig, TaskDecompositionSkill } from './agent';
export { AgentDispatchSkill } from './skills/agent-dispatch';
export { LockManagementSkill } from './skills/lock-management';
export { TaskReviewSkill } from './skills/task-review';
export { DecisionLogSkill } from './skills/decision-log';

export type { DispatchInput, DispatchResult, DispatchContext } from './skills/agent-dispatch';
export type { LockManagementInput, LockManagementResult } from './skills/lock-management';
export type { ReviewInput, ReviewReport, TaskOutput } from './skills/task-review';
export type { DecisionLogInput, DecisionLogResult, DecisionInput } from './skills/decision-log';
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: update exports and verify Phase 3 build"
```

---

## Summary

**Phase 3 Completed Tasks:**
1. TaskReviewSkill - Spec compliance and code quality review
2. DecisionLogSkill - Record and query decisions
3. Web Package Setup - Express server with health/status endpoints
4. API Routes - Tasks, Agents, Status REST API
5. Integration - Updated exports and verified build

**API Endpoints:**
- GET /api/health - Health check
- GET /api/status - Project status
- GET/POST /api/tasks - Task management
- GET/POST /api/agents - Agent management

**Next (Phase 4):**
- Semantic conflict detection (Layer 3)
- TUI interface
- Full Web Dashboard
- Logging system
- Documentation and examples