# Multi-Agent Collaboration System - Phase 1 MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build MVP of multi-agent orchestration system with Project Brain, Lock Manager, CLI, Agent Adapter, and basic Orchestrator skeleton.

**Architecture:** Monorepo with Turborepo containing 5 packages (core, orchestrator, adapter, cli, web). Mastra for orchestration, A2A Protocol for agent communication.

**Tech Stack:** TypeScript, Mastra, Zod, Node.js, Turborepo

---

## File Structure

```
agent-orchestrator/
├── packages/
│   ├── core/                    # Brain + Lock + Conflict core lib
│   │   └── src/
│   │       ├── brain/           # Project Brain implementation
│   │       │   ├── brain.ts
│   │       │   ├── types.ts
│   │       │   └── persistence.ts
│   │       ├── lock/            # Lock mechanism
│   │       │   ├── manager.ts
│   │       │   ├── protocol.ts
│   │       │   └── types.ts
│   │       ├── conflict/       # Conflict detection (Layer 1 only for MVP)
│   │       │   └── detector.ts
│   │       └── index.ts
│   │
│   ├── orchestrator/           # Orchestrator Agent (Mastra)
│   │   └── src/
│   │       ├── agent.ts        # Orchestrator Agent definition
│   │       ├── skills/
│   │       │   └── task-decomposition.ts
│   │       └── index.ts
│   │
│   ├── adapter/                # Agent Adapter framework
│   │   └── src/
│   │       ├── adapter.ts
│   │       ├── cli-adapter.ts
│   │       ├── transformer.ts
│   │       ├── lock-interceptor.ts
│   │       └── index.ts
│   │
│   ├── cli/                    # CLI tool
│   │   └── src/
│   │       ├── commands/
│   │       │   ├── init.ts
│   │       │   ├── agent.ts
│   │       │   ├── task.ts
│   │       │   └── start.ts
│   │       └── index.ts
│   │
│   └── web/                    # Web Dashboard (stub for MVP)
│       └── src/
│           └── index.ts
│
├── package.json
├── tsconfig.json
└── turbo.json
```

---

## Chunk 1: Project Setup & Core Types

### Task 1: Initialize Monorepo Structure

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `turbo.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "agent-orchestrator",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.3.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

- [ ] **Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": { "cache": false, "persistent": true },
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json tsconfig.json turbo.json
git commit -m "chore: initialize monorepo structure"
```

---

### Task 2: Create Core Types

**Files:**
- Create: `packages/core/src/types.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/__tests__/types.test.ts
import { describe, it, expect } from 'vitest';

describe('Core Types', () => {
  it('should export TaskNode type', () => {
    const task: import('../types').TaskNode = {
      id: 'T001',
      title: 'Test Task',
      description: 'Test description',
      type: 'task',
      status: 'pending',
      expectedOutput: {
        type: 'code',
        description: 'Test output',
        acceptanceCriteria: []
      },
      estimatedFiles: [],
      children: [],
      dependencies: [],
      statusHistory: []
    };
    expect(task.id).toBe('T001');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

```typescript
// packages/core/src/types.ts

// Task Types
export type TaskStatus = 
  | 'pending'
  | 'ready'
  | 'assigned'
  | 'executing'
  | 'reviewing'
  | 'revision'
  | 'blocked'
  | 'completed'
  | 'failed';

export interface TaskNode {
  id: string;
  parentId?: string;
  title: string;
  description: string;
  type: 'milestone' | 'task' | 'subtask';
  assignee?: string;
  assignedAt?: Date;
  expectedOutput: {
    type: 'code' | 'document' | 'analysis' | 'decision';
    description: string;
    acceptanceCriteria: string[];
  };
  actualOutput?: {
    summary: string;
    artifacts: string[];
    files: string[];
    completedAt: Date;
  };
  status: TaskStatus;
  statusHistory: {
    status: TaskStatus;
    changedAt: Date;
    changedBy: string;
    reason?: string;
  }[];
  dependencies: string[];
  blockedBy?: string[];
  estimatedFiles: string[];
  children: string[];
}

export interface TaskTree {
  root: string;
  nodes: Map<string, TaskNode>;
}

// Agent Types
export type AgentStatus = 'online' | 'offline' | 'busy' | 'error';

export interface AgentRole {
  id: string;
  name: string;
  description: string;
  skills: {
    id: string;
    name: string;
    tags: string[];
  }[];
  workingDirectory: string;
  endpoint?: string;
  status: AgentStatus;
  currentTask?: string;
}

// Lock Types
export type LockGranularity = 'file' | 'region';
export type LockType = 'exclusive' | 'shared';
export type LockStatus = 'active' | 'released' | 'expired';

export interface CodeRegion {
  startLine: number;
  endLine: number;
  symbolName?: string;
}

export interface FileLock {
  id: string;
  file: string;
  granularity: LockGranularity;
  region?: CodeRegion;
  holder: {
    agentId: string;
    taskId: string;
  };
  type: LockType;
  status: LockStatus;
  acquiredAt: Date;
  expiresAt?: Date;
  waitingQueue: {
    agentId: string;
    taskId: string;
    requestedAt: Date;
  }[];
}

export interface LockState {
  active: FileLock[];
  history: {
    lock: FileLock;
    releasedAt: Date;
    releasedBy: string;
  }[];
}

// Project Brain Types
export interface ProjectBrain {
  id: string;
  name: string;
  version: string;
  goal: {
    description: string;
    successCriteria: string[];
    constraints: string[];
  };
  agents: AgentRole[];
  tasks: TaskTree;
  context: SharedContext;
  decisions: Decision[];
  locks: LockState;
}

export interface SharedContext {
  background: string;
  codeSnippets: Map<string, {
    file: string;
    language: string;
    content: string;
    description: string;
  }>;
  outputs: Map<string, {
    taskId: string;
    agentId: string;
    summary: string;
    artifacts: string[];
  }>;
  pendingQuestions: {
    id: string;
    question: string;
    askedBy: string;
    askedAt: Date;
    resolvedBy?: string;
    answer?: string;
  }[];
  recentFileChanges: Map<string, {
    agentId: string;
    taskId: string;
    regions?: CodeRegion[];
    timestamp: Date;
  }[]>;
}

export interface Decision {
  id: string;
  timestamp: Date;
  decision: string;
  decider: string;
  context: string;
  alternatives: string[];
  impact: string[];
  relatedTasks: string[];
  relatedFiles: string[];
}

// Conflict Detection Types
export interface FileChange {
  file: string;
  type: 'create' | 'modify' | 'delete';
  regions?: CodeRegion[];
  description: string;
  agentId: string;
}

export interface PathConflict {
  file: string;
  lockedBy: { agentId: string };
  requestedBy: string;
}

export interface ConflictReport {
  hasConflicts: boolean;
  pathConflicts: PathConflict[];
  regionConflicts: never[];
  semanticConflicts: never[];
  recommendations: string[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/__tests__/types.test.ts
git commit -m "feat(core): add TypeScript types for Project Brain, Tasks, Agents, and Locks"
```

---

## Chunk 2: Project Brain Implementation

### Task 3: Brain Persistence Layer

**Files:**
- Create: `packages/core/src/brain/types.ts`
- Create: `packages/core/src/brain/persistence.ts`
- Create: `packages/core/src/brain/brain.ts`
- Create: `packages/core/src/brain/__tests__/persistence.test.ts`
- Create: `packages/core/src/brain/__tests__/brain.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/brain/__tests__/persistence.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { BrainPersistence } from '../persistence';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('BrainPersistence', () => {
  let tempDir: string;
  let persistence: BrainPersistence;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brain-test-'));
    persistence = new BrainPersistence(tempDir);
  });

  it('should save and load brain state', async () => {
    const brain = {
      id: 'test-brain',
      name: 'Test Project',
      version: '1.0.0',
      goal: { description: 'Test goal', successCriteria: [], constraints: [] },
      agents: [],
      tasks: { root: '', nodes: new Map() },
      context: {
        background: '',
        codeSnippets: new Map(),
        outputs: new Map(),
        pendingQuestions: [],
        recentFileChanges: new Map()
      },
      decisions: [],
      locks: { active: [], history: [] }
    };

    await persistence.save(brain);
    const loaded = await persistence.load();

    expect(loaded?.id).toBe('test-brain');
    expect(loaded?.name).toBe('Test Project');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

```typescript
// packages/core/src/brain/types.ts
export { ProjectBrain, TaskNode, TaskStatus, AgentRole, AgentStatus } from '../types';

// packages/core/src/brain/persistence.ts
import { ProjectBrain } from '../types';

export class BrainPersistence {
  private filePath: string;

  constructor(private baseDir: string) {
    this.filePath = path.join(baseDir, '.agent-orch', 'brain.json');
  }

  async save(brain: ProjectBrain): Promise<void> {
    const brainDir = path.dirname(this.filePath);
    await fs.mkdir(brainDir, { recursive: true });
    
    const serializable = {
      ...brain,
      tasks: {
        root: brain.tasks.root,
        nodes: Array.from(brain.tasks.nodes.entries())
      },
      context: {
        ...brain.context,
        codeSnippets: Array.from(brain.context.codeSnippets.entries()),
        outputs: Array.from(brain.context.outputs.entries()),
        recentFileChanges: Array.from(brain.context.recentFileChanges.entries())
      }
    };
    
    await fs.writeFile(this.filePath, JSON.stringify(serializable, null, 2));
  }

  async load(): Promise<ProjectBrain | null> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(content);
      
      return {
        ...data,
        tasks: {
          root: data.tasks.root,
          nodes: new Map(data.tasks.nodes)
        },
        context: {
          ...data.context,
          codeSnippets: new Map(data.context.codeSnippets),
          outputs: new Map(data.context.outputs),
          recentFileChanges: new Map(data.context.recentFileChanges)
        }
      };
    } catch {
      return null;
    }
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }
}
```

```typescript
// packages/core/src/brain/brain.ts
import { ProjectBrain, TaskNode, AgentRole, LockState, SharedContext, Decision } from '../types';
import { BrainPersistence } from './persistence';

export class ProjectBrainImpl implements ProjectBrain {
  id: string;
  name: string;
  version: string;
  goal: { description: string; successCriteria: string[]; constraints: string[] };
  agents: AgentRole[];
  tasks: { root: string; nodes: Map<string, TaskNode> };
  context: SharedContext;
  decisions: Decision[];
  locks: LockState;
  
  private persistence: BrainPersistence;

  constructor(baseDir: string, data?: Partial<ProjectBrain>) {
    this.id = data?.id || crypto.randomUUID();
    this.name = data?.name || 'Untitled Project';
    this.version = data?.version || '1.0.0';
    this.goal = data?.goal || { description: '', successCriteria: [], constraints: [] };
    this.agents = data?.agents || [];
    this.tasks = data?.tasks || { root: '', nodes: new Map() };
    this.context = data?.context || {
      background: '',
      codeSnippets: new Map(),
      outputs: new Map(),
      pendingQuestions: [],
      recentFileChanges: new Map()
    };
    this.decisions = data?.decisions || [];
    this.locks = data?.locks || { active: [], history: [] };
    
    this.persistence = new BrainPersistence(baseDir);
  }

  async save(): Promise<void> {
    await this.persistence.save(this);
  }

  async load(): Promise<boolean> {
    const loaded = await this.persistence.load();
    if (loaded) {
      Object.assign(this, loaded);
      return true;
    }
    return false;
  }

  addTask(task: TaskNode): void {
    this.tasks.nodes.set(task.id, task);
  }

  getTask(taskId: string): TaskNode | undefined {
    return this.tasks.nodes.get(taskId);
  }

  updateTaskStatus(taskId: string, status: TaskNode['status'], changedBy: string, reason?: string): void {
    const task = this.tasks.nodes.get(taskId);
    if (task) {
      task.statusHistory.push({ status, changedAt: new Date(), changedBy, reason });
      task.status = status;
    }
  }

  addAgent(agent: AgentRole): void {
    const existing = this.agents.findIndex(a => a.id === agent.id);
    if (existing >= 0) {
      this.agents[existing] = agent;
    } else {
      this.agents.push(agent);
    }
  }

  getAgent(agentId: string): AgentRole | undefined {
    return this.agents.find(a => a.id === agentId);
  }
}

import * as fs from 'fs/promises';
import * as path from 'path';
import { TaskNode } from '../types';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/brain/
git commit -m "feat(core): implement Project Brain with persistence"
```

---

## Chunk 3: Lock Manager Implementation

### Task 4: Lock Manager

**Files:**
- Create: `packages/core/src/lock/manager.ts`
- Create: `packages/core/src/lock/types.ts`
- Create: `packages/core/src/lock/__tests__/manager.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/lock/__tests__/manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { LockManager } from '../manager';

describe('LockManager', () => {
  let manager: LockManager;

  beforeEach(() => {
    manager = new LockManager();
  });

  it('should acquire exclusive lock', async () => {
    const result = await manager.acquireLock({
      agentId: 'agent-1',
      taskId: 'task-1',
      files: ['file1.ts'],
      granularity: 'file',
      type: 'exclusive'
    });

    expect(result.granted).toBe(true);
    expect(result.lockId).toBeDefined();
  });

  it('should deny lock when file already locked', async () => {
    await manager.acquireLock({
      agentId: 'agent-1',
      taskId: 'task-1',
      files: ['file1.ts'],
      granularity: 'file',
      type: 'exclusive'
    });

    const result = await manager.acquireLock({
      agentId: 'agent-2',
      taskId: 'task-2',
      files: ['file1.ts'],
      granularity: 'file',
      type: 'exclusive'
    });

    expect(result.granted).toBe(false);
    expect(result.reason).toContain('locked');
  });

  it('should release lock', async () => {
    const acquireResult = await manager.acquireLock({
      agentId: 'agent-1',
      taskId: 'task-1',
      files: ['file1.ts'],
      granularity: 'file',
      type: 'exclusive'
    });

    await manager.releaseLock(acquireResult.lockId!);

    const locks = manager.getLocks();
    expect(locks.filter(l => l.status === 'active').length).toBe(0);
  });

  it('should queue waiting requests', async () => {
    await manager.acquireLock({
      agentId: 'agent-1',
      taskId: 'task-1',
      files: ['file1.ts'],
      granularity: 'file',
      type: 'exclusive'
    });

    const result = await manager.acquireLock({
      agentId: 'agent-2',
      taskId: 'task-2',
      files: ['file1.ts'],
      granularity: 'file',
      type: 'exclusive'
    });

    expect(result.granted).toBe(false);
    expect(result.waitingQueuePosition).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

```typescript
// packages/core/src/lock/types.ts
export { FileLock, LockGranularity, LockType, LockStatus, CodeRegion } from '../types';

export interface LockRequest {
  agentId: string;
  taskId: string;
  files: string[];
  granularity: LockGranularity;
  regions?: CodeRegion[];
  type: LockType;
  expiresIn?: number;
}

export interface LockResult {
  granted: boolean;
  lockId?: string;
  reason?: string;
  waitingQueuePosition?: number;
}

// packages/core/src/lock/manager.ts
import { FileLock, LockStatus, LockType, LockGranularity, CodeRegion } from '../types';

export interface LockRequest {
  agentId: string;
  taskId: string;
  files: string[];
  granularity: LockGranularity;
  regions?: CodeRegion[];
  type: LockType;
  expiresIn?: number;
}

export interface LockResult {
  granted: boolean;
  lockId?: string;
  reason?: string;
  waitingQueuePosition?: number;
}

export class LockManager {
  private locks: FileLock[] = [];
  private defaultExpiry = 30 * 60 * 1000; // 30 minutes

  async acquireLock(request: LockRequest): Promise<LockResult> {
    const { agentId, taskId, files, granularity, type, expiresIn } = request;

    for (const file of files) {
      const existingLock = this.locks.find(
        l => l.file === file && l.status === 'active' && l.type === 'exclusive'
      );

      if (existingLock) {
        const queuePosition = existingLock.waitingQueue.length + 1;
        existingLock.waitingQueue.push({ agentId, taskId, requestedAt: new Date() });
        
        return {
          granted: false,
          reason: `File ${file} is locked by ${existingLock.holder.agentId}`,
          waitingQueuePosition: queuePosition
        };
      }
    }

    const lockId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + (expiresIn || this.defaultExpiry));

    for (const file of files) {
      const lock: FileLock = {
        id: lockId,
        file,
        granularity,
        holder: { agentId, taskId },
        type,
        status: 'active',
        acquiredAt: new Date(),
        expiresAt,
        waitingQueue: []
      };
      this.locks.push(lock);
    }

    return { granted: true, lockId };
  }

  async releaseLock(lockId: string): Promise<void> {
    const locksToRelease = this.locks.filter(l => l.id === lockId);
    
    for (const lock of locksToRelease) {
      lock.status = 'released';
      
      // Process waiting queue
      if (lock.waitingQueue.length > 0) {
        const next = lock.waitingQueue.shift()!;
        lock.holder = { agentId: next.agentId, taskId: next.taskId };
        lock.acquiredAt = new Date();
        lock.expiresAt = new Date(Date.now() + this.defaultExpiry);
        lock.status = 'active';
      }
    }
  }

  async releaseAllForAgent(agentId: string): Promise<void> {
    const agentLocks = this.locks.filter(l => l.holder.agentId === agentId && l.status === 'active');
    for (const lock of agentLocks) {
      await this.releaseLock(lock.id);
    }
  }

  getLocks(filters?: { agentId?: string; file?: string }): FileLock[] {
    let result = this.locks.filter(l => l.status === 'active');
    
    if (filters?.agentId) {
      result = result.filter(l => l.holder.agentId === filters.agentId);
    }
    if (filters?.file) {
      result = result.filter(l => l.file === filters.file);
    }
    
    return result;
  }

  getLockStatus(file: string): { locked: boolean; holder?: string } {
    const lock = this.locks.find(l => l.file === file && l.status === 'active');
    return {
      locked: !!lock,
      holder: lock?.holder.agentId
    };
  }

  async cleanupExpired(): Promise<void> {
    const now = new Date();
    const expired = this.locks.filter(l => l.status === 'active' && l.expiresAt && l.expiresAt < now);
    
    for (const lock of expired) {
      await this.releaseLock(lock.id);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/lock/
git commit -m "feat(core): implement Lock Manager with queue support"
```

---

## Chunk 4: Conflict Detection (Layer 1)

### Task 5: Path Conflict Detector

**Files:**
- Create: `packages/core/src/conflict/detector.ts`
- Create: `packages/core/src/conflict/__tests__/detector.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/conflict/__tests__/detector.test.ts
import { describe, it, expect } from 'vitest';
import { ConflictDetector } from '../detector';
import { LockManager } from '../../lock/manager';

describe('ConflictDetector', () => {
  it('should detect path conflict', async () => {
    const lockManager = new LockManager();
    const detector = new ConflictDetector(lockManager);

    await lockManager.acquireLock({
      agentId: 'agent-1',
      taskId: 'task-1',
      files: ['file1.ts'],
      granularity: 'file',
      type: 'exclusive'
    });

    const report = await detector.detectConflicts([
      { file: 'file1.ts', type: 'modify', agentId: 'agent-2', description: 'Test' }
    ]);

    expect(report.hasConflicts).toBe(true);
    expect(report.pathConflicts.length).toBe(1);
    expect(report.pathConflicts[0].requestedBy).toBe('agent-2');
  });

  it('should return no conflicts when files not locked', async () => {
    const lockManager = new LockManager();
    const detector = new ConflictDetector(lockManager);

    const report = await detector.detectConflicts([
      { file: 'new-file.ts', type: 'create', agentId: 'agent-1', description: 'Test' }
    ]);

    expect(report.hasConflicts).toBe(false);
    expect(report.pathConflicts.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

```typescript
// packages/core/src/conflict/detector.ts
import { ConflictReport, FileChange, PathConflict } from '../types';
import { LockManager } from '../lock/manager';

export class ConflictDetector {
  constructor(private lockManager: LockManager) {}

  async detectConflicts(plannedChanges: FileChange[]): Promise<ConflictReport> {
    const pathConflicts: PathConflict[] = [];
    const recommendations: string[] = [];

    for (const change of plannedChanges) {
      const lockStatus = this.lockManager.getLockStatus(change.file);
      
      if (lockStatus.locked && lockStatus.holder && lockStatus.holder !== change.agentId) {
        pathConflicts.push({
          file: change.file,
          lockedBy: { agentId: lockStatus.holder },
          requestedBy: change.agentId
        });
        recommendations.push(`File ${change.file} is locked by ${lockStatus.holder}. Wait for release or request hand-off.`);
      }
    }

    return {
      hasConflicts: pathConflicts.length > 0,
      pathConflicts,
      regionConflicts: [],
      semanticConflicts: [],
      recommendations
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/conflict/
git commit -m "feat(core): implement Layer 1 conflict detection"
```

---

## Chunk 5: Agent Adapter Framework

### Task 6: CLI Agent Adapter

**Files:**
- Create: `packages/adapter/src/adapter.ts`
- Create: `packages/adapter/src/cli-adapter.ts`
- Create: `packages/adapter/src/transformer.ts`
- Create: `packages/adapter/src/lock-interceptor.ts`
- Create: `packages/adapter/src/__tests__/cli-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/adapter/src/__tests__/cli-adapter.test.ts
import { describe, it, expect, vi } from 'vitest';
import { CliAdapter } from '../cli-adapter';

describe('CliAdapter', () => {
  it('should execute CLI command and return output', async () => {
    const adapter = new CliAdapter({
      name: 'test-agent',
      command: 'echo',
      args: ['hello'],
      cwd: process.cwd()
    });

    const result = await adapter.execute({ task: 'test task', context: {} });
    
    expect(result.output).toContain('hello');
  });

  it('should apply input transform', async () => {
    const adapter = new CliAdapter({
      name: 'test-agent',
      command: 'cat',
      args: [],
      cwd: process.cwd(),
      inputTemplate: 'Task: {{task}}'
    });

    const result = await adapter.execute({ task: 'my-task', context: {} });
    expect(result.output).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

```typescript
// packages/adapter/src/adapter.ts
export interface AgentAdapterConfig {
  name: string;
  description?: string;
  version?: string;
  command: string;
  args?: string[];
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
  inputTemplate?: string;
  skills?: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
  }>;
}

export interface AdapterContext {
  task: string;
  context: {
    codeSnippets?: Array<{ file: string; content: string; language: string }>;
    locks?: Array<{ file: string; holder: string }>;
    [key: string]: unknown;
  };
}

export interface AdapterResult {
  output: string;
  artifacts?: string[];
  error?: string;
}

export interface AgentAdapter {
  config: AgentAdapterConfig;
  execute(context: AdapterContext): Promise<AdapterResult>;
  getStatus(): Promise<{ online: boolean; error?: string }>;
}

// packages/adapter/src/cli-adapter.ts
import { spawn } from 'child_process';
import { AgentAdapter, AgentAdapterConfig, AdapterContext, AdapterResult } from './adapter';

export class CliAdapter implements AgentAdapter {
  config: AgentAdapterConfig;

  constructor(config: AgentAdapterConfig) {
    this.config = {
      timeout: 300000,
      args: [],
      cwd: process.cwd(),
      ...config
    };
  }

  async execute(context: AdapterContext): Promise<AdapterResult> {
    const args = this.buildArgs(context);
    
    return new Promise((resolve) => {
      const proc = spawn(this.config.command, args, {
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env },
        shell: true
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        proc.kill();
        resolve({ output: stdout, error: 'Command timed out' });
      }, this.config.timeout);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        resolve({
          output: stdout,
          error: code !== 0 ? stderr : undefined
        });
      });
    });
  }

  private buildArgs(context: AdapterContext): string[] {
    let args = [...(this.config.args || [])];
    
    if (this.config.inputTemplate) {
      const input = this.applyTemplate(this.config.inputTemplate, context);
      args.push(input);
    }
    
    return args;
  }

  private applyTemplate(template: string, context: AdapterContext): string {
    return template
      .replace(/\{\{task\}\}/g, context.task)
      .replace(/\{\{context\.(\w+)\}\}/g, (_, key) => {
        const val = context.context[key];
        return typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
      });
  }

  async getStatus(): Promise<{ online: boolean; error?: string }> {
    try {
      const result = await this.execute({ task: '--version', context: {} });
      return { online: !result.error };
    } catch (e) {
      return { online: false, error: String(e) };
    }
  }
}

// packages/adapter/src/transformer.ts
export interface TransformConfig {
  input?: {
    template: string;
  };
  output?: {
    parse: 'markdown' | 'json' | 'text';
    extract?: Array<{
      pattern: string;
      action: string;
    }>;
  };
}

export class Transformer {
  applyInputTransform(template: string, data: Record<string, unknown>): string {
    let result = template;
    
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value));
    }
    
    // Handle loops like {{#each items}}{{/each}}
    const eachRegex = /\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    result = result.replace(eachRegex, (_, key, inner) => {
      const items = data[key] as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(items)) return '';
      return items.map(item => {
        let innerResult = inner;
        for (const [k, v] of Object.entries(item)) {
          innerResult = innerResult.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
        }
        return innerResult;
      }).join('');
    });
    
    return result;
  }

  parseOutput(content: string, config: TransformConfig['output']): Record<string, unknown> {
    if (!config) return { raw: content };

    if (config.parse === 'json') {
      try {
        return JSON.parse(content);
      } catch {
        return { raw: content };
      }
    }

    return { raw: content };
  }
}

// packages/adapter/src/lock-interceptor.ts
export interface LockDeclaration {
  action: 'request_lock' | 'release_lock';
  files: string[];
}

export class LockInterceptor {
  private declarePattern = /\[DECLARE\]\s*我要修改:\s*(.+)/g;
  private releasePattern = /\[RELEASE\]\s*(.+)/g;

  parseDeclarations(output: string): LockDeclaration[] {
    const declarations: LockDeclaration[] = [];
    
    let match;
    while ((match = this.declarePattern.exec(output)) !== null) {
      const files = match[1].split(',').map(f => f.trim());
      declarations.push({ action: 'request_lock', files });
    }
    
    this.declarePattern.lastIndex = 0;
    while ((match = this.releasePattern.exec(output)) !== null) {
      const files = match[1].split(',').map(f => f.trim());
      declarations.push({ action: 'release_lock', files });
    }
    
    return declarations;
  }

  injectLockResult(output: string, file: string, granted: boolean, holder?: string): string {
    const prefix = granted 
      ? `[LOCK GRANTED] ${file}\n` 
      : `[LOCK DENIED] ${file} - 被 ${holder} 锁定\n`;
    return prefix + output;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/adapter/src/
git commit -m "feat(adapter): implement CLI Agent Adapter with transformer and lock interceptor"
```

---

## Chunk 6: Orchestrator Agent (Mastra)

### Task 7: Orchestrator Agent with TaskDecompositionSkill

**Files:**
- Create: `packages/orchestrator/src/agent.ts`
- Create: `packages/orchestrator/src/skills/task-decomposition.ts`
- Create: `packages/orchestrator/src/index.ts`
- Create: `packages/orchestrator/package.json`
- Create: `packages/orchestrator/tsconfig.json`
- Create: `packages/orchestrator/src/__tests__/task-decomposition.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/orchestrator/src/__tests__/task-decomposition.test.ts
import { describe, it, expect } from 'vitest';
import { TaskDecompositionSkill } from '../skills/task-decomposition';

describe('TaskDecompositionSkill', () => {
  it('should decompose simple task', async () => {
    const skill = new TaskDecompositionSkill();
    
    const result = await skill.execute({
      taskDescription: '将 CardTableViewCell 迁移到 SwiftUI',
      goal: '完成 CardTableViewCell 的迁移',
      constraints: ['保持 API 兼容'],
      availableAgents: [
        { id: 'qoder', name: 'Qoder', description: 'Native 专家', skills: [{ id: 'analyze', name: '分析', tags: ['objc'] }], workingDirectory: '', status: 'online' }
      ]
    });

    expect(result.subtasks.length).toBeGreaterThan(0);
    expect(result.subtasks[0].title).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

```typescript
// packages/orchestrator/package.json
{
  "name": "@agent-orchestrator/orchestrator",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "dev": "mastra dev",
    "build": "mastra build"
  },
  "dependencies": {
    "@mastra/core": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}

// packages/orchestrator/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}

// packages/orchestrator/src/skills/task-decomposition.ts
import { TaskNode, AgentRole } from '@agent-orchestrator/core/types';

interface DecompositionInput {
  taskDescription: string;
  goal: string;
  constraints: string[];
  availableAgents: AgentRole[];
}

interface Subtask {
  id: string;
  title: string;
  description: string;
  type: 'task' | 'subtask';
  estimatedFiles: string[];
  suggestedAgent?: string;
}

interface DecompositionResult {
  subtasks: Subtask[];
  dependencies: Map<string, string[]>;
  assignments: Map<string, string[]>;
}

export class TaskDecompositionSkill {
  async execute(input: DecompositionInput): Promise<DecompositionResult> {
    const subtasks: Subtask[] = [];
    const dependencies = new Map<string, string[]>();
    const assignments = new Map<string, string[]>();

    // Simple heuristic decomposition for MVP
    // In production, this would use AI to analyze the task
    
    const description = input.taskDescription.toLowerCase();
    
    // Detect migration task
    if (description.includes('迁移') || description.includes('migrate') || description.includes('migration')) {
      subtasks.push({
        id: 'T001',
        title: '分析原始代码',
        description: `分析 ${input.goal} 的原始实现`,
        type: 'task',
        estimatedFiles: [],
        suggestedAgent: this.findAgentBySkill(input.availableAgents, ['analysis', 'analyze', 'objc'])
      });

      subtasks.push({
        id: 'T002',
        title: '设计新实现',
        description: '设计新技术的实现方案',
        type: 'task',
        estimatedFiles: [],
        dependencies: ['T001'],
        suggestedAgent: this.findAgentBySkill(input.availableAgents, ['design', 'architecture'])
      });

      subtasks.push({
        id: 'T003',
        title: '实现新代码',
        description: '根据设计方案实现',
        type: 'task',
        estimatedFiles: [],
        dependencies: ['T002'],
        suggestedAgent: this.findAgentBySkill(input.availableAgents, ['code', 'implement', 'swift'])
      });

      subtasks.push({
        id: 'T004',
        title: '编写测试',
        description: '为新实现编写单元测试',
        type: 'task',
        estimatedFiles: [],
        dependencies: ['T003'],
        suggestedAgent: this.findAgentBySkill(input.availableAgents, ['test', 'testing'])
      });
    } else {
      // Generic single task
      subtasks.push({
        id: 'T001',
        title: input.taskDescription,
        description: input.goal,
        type: 'task',
        estimatedFiles: []
      });
    }

    for (const task of subtasks) {
      if (task.dependencies) {
        dependencies.set(task.id, task.dependencies);
      }
      if (task.suggestedAgent) {
        assignments.set(task.id, [task.suggestedAgent]);
      }
    }

    return { subtasks, dependencies, assignments };
  }

  private findAgentBySkill(agents: AgentRole[], skillTags: string[]): string | undefined {
    for (const tag of skillTags) {
      const agent = agents.find(a => 
        a.skills.some(s => 
          s.tags.includes(tag) || s.name.toLowerCase().includes(tag)
        )
      );
      if (agent) return agent.id;
    }
    return agents[0]?.id;
  }
}

// packages/orchestrator/src/agent.ts
import { Agent } from '@mastra/core/agent';
import { TaskDecompositionSkill } from './skills/task-decomposition';

export const orchestratorAgent = new Agent({
  id: 'orchestrator',
  name: 'Orchestrator Agent',
  instructions: `
    You are the Orchestrator Agent responsible for coordinating multiple AI agents.
    
    Your responsibilities:
    1. Receive human instructions via CLI or API
    2. Decompose complex tasks into subtasks
    3. Assign tasks to appropriate agents based on their skills
    4. Monitor task execution status
    5. Detect and handle conflicts
    6. Coordinate information transfer between agents
    7. Report progress and request human decisions
    8. Maintain Project Brain (shared cognition)
    
    Always follow the lock protocol:
    - Agents must declare files before modifying
    - Locks prevent concurrent modifications
    - Release locks after完成任务
  `,
  model: 'google/gemini-2.5-pro',
  tools: {}
});

// packages/orchestrator/src/index.ts
import { Mastra } from '@mastra/core';
import { orchestratorAgent } from './agent';

export const mastra = new Mastra({
  agents: { orchestratorAgent }
});

export { orchestratorAgent, TaskDecompositionSkill } from './agent';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/orchestrator/
git commit -m "feat(orchestrator): implement Orchestrator Agent with TaskDecompositionSkill"
```

---

## Chunk 7: CLI Tool

### Task 8: Basic CLI Commands

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/commands/init.ts`
- Create: `packages/cli/src/commands/agent.ts`
- Create: `packages/cli/src/commands/task.ts`
- Create: `packages/cli/src/commands/start.ts`
- Create: `packages/cli/src/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/cli/src/__tests__/init.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initCommand } from '../commands/init';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('init command', () => {
  it('should create .agent-orch directory', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-test-'));
    
    await initCommand(tempDir, {
      name: 'Test Project',
      description: 'Test description',
      goal: 'Test goal'
    });
    
    const configPath = path.join(tempDir, '.agent-orch', 'config.yaml');
    const brainPath = path.join(tempDir, '.agent-orch', 'brain.json');
    
    expect(await fs.access(configPath)).toBeUndefined();
    expect(await fs.access(brainPath)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

```typescript
// packages/cli/package.json
{
  "name": "@agent-orchestrator/cli",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "agent-orch": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@agent-orchestrator/core": "workspace:*",
    "@agent-orchestrator/orchestrator": "workspace:*",
    "commander": "^11.0.0",
    "chalk": "^5.3.0",
    "inquirer": "^9.2.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "vitest": "^1.0.0"
  }
}

// packages/cli/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}

// packages/cli/src/commands/init.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { ProjectBrain } from '@agent-orchestrator/core/types';

interface InitOptions {
  name: string;
  description: string;
  goal: string;
}

export async function initCommand(baseDir: string, options: InitOptions): Promise<void> {
  const orchDir = path.join(baseDir, '.agent-orch');
  await fs.mkdir(orchDir, { recursive: true });

  const brain: ProjectBrain = {
    id: crypto.randomUUID(),
    name: options.name,
    version: '1.0.0',
    goal: {
      description: options.goal,
      successCriteria: [],
      constraints: []
    },
    agents: [],
    tasks: { root: '', nodes: new Map() },
    context: {
      background: options.description,
      codeSnippets: new Map(),
      outputs: new Map(),
      pendingQuestions: [],
      recentFileChanges: new Map()
    },
    decisions: [],
    locks: { active: [], history: [] }
  };

  await fs.writeFile(
    path.join(orchDir, 'brain.json'),
    JSON.stringify(brain, null, 2)
  );

  await fs.writeFile(
    path.join(orchDir, 'config.yaml'),
    `name: ${options.name}
description: ${options.description}
goal: ${options.goal}
version: "1.0.0"
`
  );

  await fs.mkdir(path.join(orchDir, 'agents'), { recursive: true });
  
  console.log('✓ Created .agent-orch/config.yaml');
  console.log('✓ Created .agent-orch/brain.json');
  console.log('✓ Created .agent-orch/agents/');
}

// packages/cli/src/commands/agent.ts
import inquirer from 'inquirer';
import * as fs from 'fs/promises';
import * as path from 'path';

interface AgentConfig {
  name: string;
  description: string;
  type: 'cli' | 'api';
  command?: string;
  endpoint?: string;
  cwd?: string;
  skills: string[];
}

export async function addAgentCommand(baseDir: string, name: string, configPath?: string): Promise<void> {
  let config: AgentConfig;
  
  if (configPath) {
    const content = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(content);
  } else {
    const answers = await inquirer.prompt([
      { type: 'input', name: 'name', default: name, message: 'Agent name:' },
      { type: 'input', name: 'description', message: 'Description:' },
      { type: 'list', name: 'type', choices: ['cli', 'api'], message: 'Agent type:' },
      { type: 'input', name: 'command', message: 'Command path:', when: (a) => a.type === 'cli' },
      { type: 'input', name: 'cwd', message: 'Working directory:', when: (a) => a.type === 'cli' },
      { type: 'input', name: 'endpoint', message: 'API endpoint:', when: (a) => a.type === 'api' },
      { type: 'input', name: 'skills', message: 'Skills (comma-separated):' }
    ]);
    config = answers;
  }

  const agentPath = path.join(baseDir, '.agent-orch', 'agents', `${name}.json`);
  await fs.writeFile(agentPath, JSON.stringify(config, null, 2));
  
  console.log(`✓ Agent "${name}" registered`);
}

export async function listAgentsCommand(baseDir: string): Promise<void> {
  const agentsDir = path.join(baseDir, '.agent-orch', 'agents');
  
  try {
    const files = await fs.readdir(agentsDir);
    if (files.length === 0) {
      console.log('No agents registered');
      return;
    }
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(agentsDir, file), 'utf-8');
        const config = JSON.parse(content);
        console.log(`- ${config.name}: ${config.description}`);
      }
    }
  } catch {
    console.log('No agents registered');
  }
}

// packages/cli/src/commands/task.ts
import inquirer from 'inquirer';
import { ProjectBrain } from '@agent-orchestrator/core/types';

interface TaskConfig {
  title: string;
  description: string;
  type: 'code' | 'document' | 'analysis' | 'decision';
  acceptanceCriteria: string[];
}

export async function createTaskCommand(brain: ProjectBrain, taskConfig?: Partial<TaskConfig>): Promise<string> {
  let config: TaskConfig;
  
  if (taskConfig) {
    config = taskConfig as TaskConfig;
  } else {
    const answers = await inquirer.prompt([
      { type: 'input', name: 'title', message: 'Task title:' },
      { type: 'input', name: 'description', message: 'Description:' },
      { type: 'list', name: 'type', choices: ['code', 'document', 'analysis', 'decision'], message: 'Expected output type:' },
      { type: 'input', name: 'acceptanceCriteria', message: 'Acceptance criteria (comma-separated):' }
    ]);
    config = {
      ...answers,
      acceptanceCriteria: answers.acceptanceCriteria.split(',').map(s => s.trim())
    };
  }

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

// packages/cli/src/commands/start.ts
import { ProjectBrainImpl } from '@agent-orchestrator/core/brain/brain';
import { mastra } from '@agent-orchestrator/orchestrator';

export async function startCommand(baseDir: string): Promise<void> {
  const brain = new ProjectBrainImpl(baseDir);
  await brain.load();
  
  console.log('Starting Orchestrator Agent...');
  console.log(`Project: ${brain.name}`);
  console.log(`Agents: ${brain.agents.length}`);
  console.log(`Tasks: ${brain.tasks.nodes.size}`);
  
  // Start Mastra dev server
  console.log('\n✓ Orchestrator started');
  console.log('Visit http://localhost:4111 for Mastra Studio');
}

// packages/cli/src/index.ts
import { Command } from 'commander';
import { initCommand } from './commands/init';
import { addAgentCommand, listAgentsCommand } from './commands/agent';
import { createTaskCommand } from './commands/task';
import { startCommand } from './commands/start';
import { ProjectBrainImpl } from '@agent-orchestrator/core/brain/brain';

const program = new Command();

program
  .name('agent-orch')
  .description('Multi-Agent Orchestration System')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize project')
  .action(async () => {
    const baseDir = process.cwd();
    await initCommand(baseDir, {
      name: 'My Project',
      description: 'Agent collaboration project',
      goal: 'Complete project goals'
    });
  });

const agentCmd = program
  .command('agent')
  .description('Manage agents');

agentCmd
  .command('add <name>')
  .description('Add new agent')
  .option('-c, --config <path>', 'Config file path')
  .action(async (name, options) => {
    const baseDir = process.cwd();
    await addAgentCommand(baseDir, name, options.config);
  });

agentCmd
  .command('list')
  .description('List all agents')
  .action(async () => {
    const baseDir = process.cwd();
    await listAgentsCommand(baseDir);
  });

program
  .command('task')
  .description('Manage tasks')
  .command('create')
  .description('Create new task')
  .action(async () => {
    const baseDir = process.cwd();
    const brain = new ProjectBrainImpl(baseDir);
    await brain.load();
    await createTaskCommand(brain);
  });

program
  .command('start')
  .description('Start orchestration')
  .action(async () => {
    const baseDir = process.cwd();
    await startCommand(baseDir);
  });

program.parse();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/
git commit -m "feat(cli): implement basic CLI commands (init, agent, task, start)"
```

---

## Chunk 8: Package Integration

### Task 9: Link Packages and Verify Build

**Files:**
- Modify: `packages/core/package.json`
- Modify: `packages/adapter/package.json`
- Create: `packages/core/package.json`
- Create: `packages/adapter/package.json`

- [ ] **Step 1: Create all package.json files**

```json
// packages/core/package.json
{
  "name": "@agent-orchestrator/core",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}

{
  "name": "@agent-orchestrator/adapter",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  },
  "dependencies": {
    "@agent-orchestrator/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

- [ ] **Step 2: Run npm install**

```bash
npm install
```

- [ ] **Step 3: Run build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/*/package.json
git commit -m "chore: finalize package configuration and verify build"
```

---

## Summary

**Completed Tasks:**
1. Monorepo setup (package.json, tsconfig.json, turbo.json)
2. Core types (Task, Agent, Lock, Brain, Conflict)
3. Project Brain with persistence
4. Lock Manager with queue support
5. Layer 1 Conflict Detection
6. CLI Agent Adapter with transformer and lock interceptor
7. Orchestrator Agent with TaskDecompositionSkill
8. Basic CLI commands (init, agent, task, start)
9. Package integration and build verification

**Next (Phase 2):**
- AgentDispatchSkill
- LockManagementSkill integration
- More CLI commands (status, lock)
- Agent configuration from YAML

---

Plan complete and saved to `docs/superpowers/plans/2026-03-19-agent-collaboration-phase1.md`. Ready to execute?