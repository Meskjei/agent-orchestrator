# Multi-Agent Collaboration System - Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build collaboration core with AgentDispatchSkill, LockManagementSkill, Layer 2 conflict detection, lock protocol prompts, and task state machine.

**Architecture:** Extend existing packages with dispatch skill, lock skill integration, region-based conflict detection, and prompt templates.

**Tech Stack:** TypeScript, Mastra, Zod, Node.js

---

## File Structure

```
packages/
├── core/
│   └── src/
│       ├── conflict/
│       │   └── region-detector.ts    # NEW: Layer 2 conflict detection
│       └── task/
│           └── state-machine.ts      # NEW: Task state transitions
│
├── orchestrator/
│   └── src/
│       └── skills/
│           ├── agent-dispatch.ts     # NEW: AgentDispatchSkill
│           └── lock-management.ts    # NEW: LockManagementSkill
│
└── adapter/
    └── src/
        └── prompts/
            └── lock-protocol.ts      # NEW: Lock protocol prompt templates
```

---

## Chunk 1: AgentDispatchSkill

### Task 1: AgentDispatchSkill Implementation

**Files:**
- Create: `packages/orchestrator/src/skills/agent-dispatch.ts`
- Create: `packages/orchestrator/src/skills/__tests__/agent-dispatch.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/orchestrator/src/skills/__tests__/agent-dispatch.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AgentDispatchSkill } from '../agent-dispatch';
import { LockManager } from '@agent-orchestrator/core/lock/manager';
import { CliAdapter } from '@agent-orchestrator/adapter/cli-adapter';

describe('AgentDispatchSkill', () => {
  it('should dispatch task to agent', async () => {
    const lockManager = new LockManager();
    const adapter = new CliAdapter({
      name: 'test-agent',
      command: 'echo',
      args: ['done'],
      cwd: process.cwd()
    });

    const skill = new AgentDispatchSkill(lockManager, { 'test-agent': adapter });

    const result = await skill.execute({
      agentId: 'test-agent',
      task: {
        id: 'T001',
        title: 'Test task',
        description: 'Test description',
        type: 'task',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: ['file1.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      context: {
        projectGoal: 'Test project',
        agentRole: 'developer',
        relevantCodeSnippets: [],
        relatedOutputs: [],
        currentLocks: []
      }
    });

    expect(result.status).toBe('completed');
    expect(result.output.summary).toContain('done');
  });

  it('should acquire locks before execution', async () => {
    const lockManager = new LockManager();
    const adapter = new CliAdapter({
      name: 'test-agent',
      command: 'echo',
      args: ['done'],
      cwd: process.cwd()
    });

    const skill = new AgentDispatchSkill(lockManager, { 'test-agent': adapter });

    await skill.execute({
      agentId: 'test-agent',
      task: {
        id: 'T001',
        title: 'Test task',
        description: 'Test description',
        type: 'task',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: ['file1.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      context: {
        projectGoal: 'Test project',
        agentRole: 'developer',
        relevantCodeSnippets: [],
        relatedOutputs: [],
        currentLocks: []
      }
    });

    const locks = lockManager.getLocks({ agentId: 'test-agent' });
    expect(locks.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

```typescript
// packages/orchestrator/src/skills/agent-dispatch.ts
import { LockManager } from '@agent-orchestrator/core/lock/manager';
import { TaskNode, CodeRegion } from '@agent-orchestrator/core/types';
import { CliAdapter, AdapterContext, AdapterResult } from '@agent-orchestrator/adapter';

export interface DispatchContext {
  projectGoal: string;
  agentRole: string;
  relevantCodeSnippets: Array<{ file: string; content: string; language: string }>;
  relatedOutputs: Array<{ taskId: string; agentId: string; summary: string }>;
  currentLocks: Array<{ file: string; holder: string }>;
}

export interface DispatchInput {
  agentId: string;
  task: TaskNode;
  context: DispatchContext;
}

export interface DispatchResult {
  status: 'completed' | 'blocked' | 'failed' | 'needs_clarification';
  output: {
    summary: string;
    files: string[];
    artifacts: string[];
  };
  locksAcquired: string[];
  locksReleased: string[];
  questions?: string[];
}

export class AgentDispatchSkill {
  constructor(
    private lockManager: LockManager,
    private adapters: Record<string, CliAdapter>
  ) {}

  async execute(input: DispatchInput): Promise<DispatchResult> {
    const { agentId, task, context } = input;
    const adapter = this.adapters[agentId];

    if (!adapter) {
      return {
        status: 'failed',
        output: { summary: `Agent ${agentId} not found`, files: [], artifacts: [] },
        locksAcquired: [],
        locksReleased: []
      };
    }

    // Acquire locks for estimated files
    const lockResult = await this.lockManager.acquireLock({
      agentId,
      taskId: task.id,
      files: task.estimatedFiles,
      granularity: 'file',
      type: 'exclusive'
    });

    if (!lockResult.granted) {
      return {
        status: 'blocked',
        output: { summary: lockResult.reason || 'Lock denied', files: [], artifacts: [] },
        locksAcquired: [],
        locksReleased: []
      };
    }

    try {
      // Build adapter context
      const adapterContext: AdapterContext = {
        task: `${task.title}\n\n${task.description}`,
        context: {
          projectGoal: context.projectGoal,
          agentRole: context.agentRole,
          codeSnippets: context.relevantCodeSnippets,
          locks: context.currentLocks
        }
      };

      // Execute agent
      const result = await adapter.execute(adapterContext);

      const status = result.error ? 'failed' : 'completed';

      return {
        status,
        output: {
          summary: result.output,
          files: task.estimatedFiles,
          artifacts: result.artifacts || []
        },
        locksAcquired: task.estimatedFiles,
        locksReleased: []
      };
    } catch (error) {
      return {
        status: 'failed',
        output: { summary: String(error), files: [], artifacts: [] },
        locksAcquired: [],
        locksReleased: []
      };
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/orchestrator/src/skills/agent-dispatch.ts
git add packages/orchestrator/src/skills/__tests__/agent-dispatch.test.ts
git commit -m "feat(orchestrator): implement AgentDispatchSkill"
```

---

## Chunk 2: LockManagementSkill

### Task 2: LockManagementSkill Integration

**Files:**
- Create: `packages/orchestrator/src/skills/lock-management.ts`
- Create: `packages/orchestrator/src/skills/__tests__/lock-management.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/orchestrator/src/skills/__tests__/lock-management.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { LockManagementSkill } from '../lock-management';
import { LockManager } from '@agent-orchestrator/core/lock/manager';

describe('LockManagementSkill', () => {
  let lockManager: LockManager;
  let skill: LockManagementSkill;

  beforeEach(() => {
    lockManager = new LockManager();
    skill = new LockManagementSkill(lockManager);
  });

  it('should acquire lock', async () => {
    const result = await skill.execute({
      action: 'acquire',
      agentId: 'agent-1',
      taskId: 'task-1',
      files: ['file1.ts']
    });

    expect(result.success).toBe(true);
    expect(result.lockId).toBeDefined();
  });

  it('should release lock', async () => {
    await skill.execute({
      action: 'acquire',
      agentId: 'agent-1',
      taskId: 'task-1',
      files: ['file1.ts']
    });

    const result = await skill.execute({
      action: 'release',
      agentId: 'agent-1',
      files: ['file1.ts']
    });

    expect(result.success).toBe(true);
  });

  it('should list locks', async () => {
    await skill.execute({
      action: 'acquire',
      agentId: 'agent-1',
      taskId: 'task-1',
      files: ['file1.ts', 'file2.ts']
    });

    const result = await skill.execute({ action: 'list' });

    expect(result.locks?.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

```typescript
// packages/orchestrator/src/skills/lock-management.ts
import { LockManager } from '@agent-orchestrator/core/lock/manager';
import { FileLock } from '@agent-orchestrator/core/types';

export interface LockManagementInput {
  action: 'acquire' | 'release' | 'list' | 'release_all';
  agentId?: string;
  taskId?: string;
  files?: string[];
}

export interface LockManagementResult {
  success: boolean;
  lockId?: string;
  reason?: string;
  locks?: FileLock[];
}

export class LockManagementSkill {
  constructor(private lockManager: LockManager) {}

  async execute(input: LockManagementInput): Promise<LockManagementResult> {
    switch (input.action) {
      case 'acquire':
        return this.acquire(input);
      case 'release':
        return this.release(input);
      case 'release_all':
        return this.releaseAll(input);
      case 'list':
        return this.list(input);
      default:
        return { success: false, reason: 'Unknown action' };
    }
  }

  private async acquire(input: LockManagementInput): Promise<LockManagementResult> {
    if (!input.agentId || !input.files || !input.taskId) {
      return { success: false, reason: 'Missing required fields' };
    }

    const result = await this.lockManager.acquireLock({
      agentId: input.agentId,
      taskId: input.taskId,
      files: input.files,
      granularity: 'file',
      type: 'exclusive'
    });

    return {
      success: result.granted,
      lockId: result.lockId,
      reason: result.reason
    };
  }

  private async release(input: LockManagementInput): Promise<LockManagementResult> {
    if (!input.agentId || !input.files) {
      return { success: false, reason: 'Missing required fields' };
    }

    const locks = this.lockManager.getLocks({ agentId: input.agentId });
    for (const lock of locks) {
      if (input.files.includes(lock.file)) {
        await this.lockManager.releaseLock(lock.id);
      }
    }

    return { success: true };
  }

  private async releaseAll(input: LockManagementInput): Promise<LockManagementResult> {
    if (!input.agentId) {
      return { success: false, reason: 'Missing agentId' };
    }

    await this.lockManager.releaseAllForAgent(input.agentId);
    return { success: true };
  }

  private async list(input: LockManagementInput): Promise<LockManagementResult> {
    const locks = this.lockManager.getLocks(
      input.agentId ? { agentId: input.agentId } : undefined
    );
    return { success: true, locks };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/orchestrator/src/skills/lock-management.ts
git add packages/orchestrator/src/skills/__tests__/lock-management.test.ts
git commit -m "feat(orchestrator): implement LockManagementSkill"
```

---

## Chunk 3: Layer 2 Conflict Detection

### Task 3: Region Conflict Detector

**Files:**
- Create: `packages/core/src/conflict/region-detector.ts`
- Create: `packages/core/src/conflict/__tests__/region-detector.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/conflict/__tests__/region-detector.test.ts
import { describe, it, expect } from 'vitest';
import { RegionConflictDetector } from '../region-detector';
import { CodeRegion } from '../../types';

describe('RegionConflictDetector', () => {
  it('should detect overlapping regions', () => {
    const detector = new RegionConflictDetector();

    const region1: CodeRegion = { startLine: 10, endLine: 20 };
    const region2: CodeRegion = { startLine: 15, endLine: 25 };

    expect(detector.regionsOverlap(region1, region2)).toBe(true);
  });

  it('should not detect non-overlapping regions', () => {
    const detector = new RegionConflictDetector();

    const region1: CodeRegion = { startLine: 10, endLine: 20 };
    const region2: CodeRegion = { startLine: 25, endLine: 35 };

    expect(detector.regionsOverlap(region1, region2)).toBe(false);
  });

  it('should detect region conflict in same file', () => {
    const detector = new RegionConflictDetector();

    const report = detector.detectRegionConflicts([
      {
        file: 'file1.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Test',
        regions: [{ startLine: 10, endLine: 20 }]
      },
      {
        file: 'file1.ts',
        type: 'modify',
        agentId: 'agent-2',
        description: 'Test',
        regions: [{ startLine: 15, endLine: 25 }]
      }
    ]);

    expect(report.hasConflicts).toBe(true);
    expect(report.conflicts.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

```typescript
// packages/core/src/conflict/region-detector.ts
import { CodeRegion, FileChange } from '../types';

export interface RegionConflict {
  file: string;
  region1: CodeRegion;
  region2: CodeRegion;
  agent1: string;
  agent2: string;
}

export interface RegionConflictReport {
  hasConflicts: boolean;
  conflicts: RegionConflict[];
}

export class RegionConflictDetector {
  regionsOverlap(r1: CodeRegion, r2: CodeRegion): boolean {
    return !(r1.endLine < r2.startLine || r2.endLine < r1.startLine);
  }

  detectRegionConflicts(changes: FileChange[]): RegionConflictReport {
    const conflicts: RegionConflict[] = [];

    // Group changes by file
    const byFile = new Map<string, FileChange[]>();
    for (const change of changes) {
      if (!change.regions || change.regions.length === 0) continue;
      
      const existing = byFile.get(change.file) || [];
      existing.push(change);
      byFile.set(change.file, existing);
    }

    // Check each file for region conflicts
    for (const [file, fileChanges] of byFile) {
      for (let i = 0; i < fileChanges.length; i++) {
        for (let j = i + 1; j < fileChanges.length; j++) {
          const change1 = fileChanges[i];
          const change2 = fileChanges[j];

          if (change1.agentId === change2.agentId) continue;

          for (const r1 of change1.regions!) {
            for (const r2 of change2.regions!) {
              if (this.regionsOverlap(r1, r2)) {
                conflicts.push({
                  file,
                  region1: r1,
                  region2: r2,
                  agent1: change1.agentId,
                  agent2: change2.agentId
                });
              }
            }
          }
        }
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/conflict/region-detector.ts
git add packages/core/src/conflict/__tests__/region-detector.test.ts
git commit -m "feat(core): implement Layer 2 region conflict detection"
```

---

## Chunk 4: Lock Protocol Prompts

### Task 4: Lock Protocol Prompt Templates

**Files:**
- Create: `packages/adapter/src/prompts/lock-protocol.ts`
- Create: `packages/adapter/src/prompts/__tests__/lock-protocol.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/adapter/src/prompts/__tests__/lock-protocol.test.ts
import { describe, it, expect } from 'vitest';
import { LockProtocolPrompt, generateLockProtocolPrompt } from '../lock-protocol';

describe('Lock Protocol Prompts', () => {
  it('should generate lock protocol prompt', () => {
    const prompt = generateLockProtocolPrompt({
      locks: [
        { file: 'file1.ts', holder: 'agent-1', status: 'active' }
      ],
      task: {
        title: 'Test task',
        description: 'Test description'
      }
    });

    expect(prompt).toContain('file1.ts');
    expect(prompt).toContain('agent-1');
    expect(prompt).toContain('[DECLARE]');
    expect(prompt).toContain('[RELEASE]');
  });

  it('should handle empty locks', () => {
    const prompt = generateLockProtocolPrompt({
      locks: [],
      task: {
        title: 'Test task',
        description: 'Test description'
      }
    });

    expect(prompt).toContain('无活跃锁');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

```typescript
// packages/adapter/src/prompts/lock-protocol.ts
export interface LockInfo {
  file: string;
  holder: string;
  status: string;
}

export interface TaskInfo {
  title: string;
  description: string;
}

export interface LockProtocolContext {
  locks: LockInfo[];
  task: TaskInfo;
}

export function generateLockProtocolPrompt(context: LockProtocolContext): string {
  const { locks, task } = context;

  let locksTable = '当前无活跃锁';
  if (locks.length > 0) {
    locksTable = `| 文件 | 锁持有者 | 状态 |
|------|---------|------|
${locks.map(l => `| ${l.file} | ${l.holder} | ${l.status} |`).join('\n')}`;
  }

  return `## 🔒 文件锁协议（必须遵守）

### 当前锁状态
${locksTable}

### 规则
1. **修改前声明**
   - 格式：\`[DECLARE] 我要修改: file1.ts, file2.ts\`
   - 等待系统确认后才能开始修改
   - 如果文件已被锁定，系统会告知你等待

2. **获取确认**
   - 成功：\`[LOCK GRANTED] file1.ts\`
   - 失败：\`[LOCK DENIED] file1.ts - 被 AgentX 锁定\`

3. **完成后释放**
   - 格式：\`[RELEASE] file1.ts\`
   - 必须在你完成修改后释放

4. **超时警告**
   - 锁默认 30 分钟后自动过期
   - 如需延长，使用 \`[EXTEND] file1.ts\`

### 当前任务上下文
- 你正在执行任务: ${task.title}
- 任务目标: ${task.description}
`;
}

export const LockProtocolPrompt = {
  generate: generateLockProtocolPrompt,

  DECLARE_PATTERN: /\[DECLARE\]\s*我要修改:\s*(.+)/g,
  RELEASE_PATTERN: /\[RELEASE\]\s*(.+)/g,
  EXTEND_PATTERN: /\[EXTEND\]\s*(.+)/g,

  GRANTED_TEMPLATE: (file: string) => `[LOCK GRANTED] ${file}`,
  DENIED_TEMPLATE: (file: string, holder: string) => `[LOCK DENIED] ${file} - 被 ${holder} 锁定`,
  EXTENDED_TEMPLATE: (file: string) => `[LOCK EXTENDED] ${file}`
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/adapter/src/prompts/
git commit -m "feat(adapter): implement lock protocol prompt templates"
```

---

## Chunk 5: Task State Machine

### Task 5: Task State Machine

**Files:**
- Create: `packages/core/src/task/state-machine.ts`
- Create: `packages/core/src/task/__tests__/state-machine.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/task/__tests__/state-machine.test.ts
import { describe, it, expect } from 'vitest';
import { TaskStateMachine, TaskStatus, canTransition } from '../state-machine';

describe('TaskStateMachine', () => {
  it('should allow valid transitions', () => {
    expect(canTransition('pending', 'ready')).toBe(true);
    expect(canTransition('ready', 'assigned')).toBe(true);
    expect(canTransition('assigned', 'executing')).toBe(true);
    expect(canTransition('executing', 'reviewing')).toBe(true);
    expect(canTransition('reviewing', 'completed')).toBe(true);
  });

  it('should deny invalid transitions', () => {
    expect(canTransition('pending', 'executing')).toBe(false);
    expect(canTransition('completed', 'executing')).toBe(false);
  });

  it('should transition with state machine', () => {
    const machine = new TaskStateMachine('pending');

    machine.transition('ready', 'dependencies completed');
    expect(machine.current).toBe('ready');

    machine.transition('assigned', 'agent-1 assigned');
    expect(machine.current).toBe('assigned');

    machine.transition('executing', 'agent started work');
    expect(machine.current).toBe('executing');
  });

  it('should record transition history', () => {
    const machine = new TaskStateMachine('pending');
    machine.transition('ready', 'test reason');

    const history = machine.getHistory();
    expect(history.length).toBe(1);
    expect(history[0].from).toBe('pending');
    expect(history[0].to).toBe('ready');
    expect(history[0].reason).toBe('test reason');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

```typescript
// packages/core/src/task/state-machine.ts
import { TaskStatus } from '../types';

type ValidTransitions = Record<TaskStatus, TaskStatus[]>;

const VALID_TRANSITIONS: ValidTransitions = {
  pending: ['ready', 'blocked'],
  ready: ['assigned', 'pending'],
  assigned: ['executing', 'ready', 'blocked'],
  executing: ['reviewing', 'blocked', 'assigned'],
  reviewing: ['completed', 'revision', 'blocked'],
  revision: ['reviewing', 'blocked'],
  blocked: ['ready', 'pending', 'failed'],
  completed: [],
  failed: ['pending', 'ready']
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface TransitionRecord {
  from: TaskStatus;
  to: TaskStatus;
  timestamp: Date;
  reason: string;
  changedBy: string;
}

export class TaskStateMachine {
  private _current: TaskStatus;
  private history: TransitionRecord[] = [];

  constructor(initial: TaskStatus = 'pending') {
    this._current = initial;
  }

  get current(): TaskStatus {
    return this._current;
  }

  transition(to: TaskStatus, reason: string, changedBy: string = 'system'): boolean {
    if (!canTransition(this._current, to)) {
      return false;
    }

    this.history.push({
      from: this._current,
      to,
      timestamp: new Date(),
      reason,
      changedBy
    });

    this._current = to;
    return true;
  }

  forceTransition(to: TaskStatus, reason: string, changedBy: string = 'admin'): void {
    this.history.push({
      from: this._current,
      to,
      timestamp: new Date(),
      reason,
      changedBy
    });

    this._current = to;
  }

  getHistory(): TransitionRecord[] {
    return [...this.history];
  }

  canTransitionTo(to: TaskStatus): boolean {
    return canTransition(this._current, to);
  }

  getValidTransitions(): TaskStatus[] {
    return VALID_TRANSITIONS[this._current] || [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/task/
git commit -m "feat(core): implement task state machine"
```

---

## Chunk 6: Integration

### Task 6: Update Exports and Verify Build

**Files:**
- Modify: `packages/core/src/index.ts`
- Modify: `packages/adapter/src/index.ts`
- Modify: `packages/orchestrator/src/index.ts`

- [ ] **Step 1: Update core exports**

```typescript
// packages/core/src/index.ts
// types
export * from './types';

// brain
export { ProjectBrainImpl } from './brain/brain';
export { BrainPersistence } from './brain/persistence';

// lock
export { LockManager } from './lock/manager';
export type { LockRequest, LockResult } from './lock/types';

// conflict
export { ConflictDetector } from './conflict/detector';
export { RegionConflictDetector } from './conflict/region-detector';
export type { RegionConflict, RegionConflictReport } from './conflict/region-detector';

// task
export { TaskStateMachine, canTransition } from './task/state-machine';
export type { TransitionRecord } from './task/state-machine';
```

- [ ] **Step 2: Update adapter exports**

```typescript
// packages/adapter/src/index.ts
export { CliAdapter } from './cli-adapter';
export { Transformer } from './transformer';
export { LockInterceptor } from './lock-interceptor';
export { LockProtocolPrompt, generateLockProtocolPrompt } from './prompts/lock-protocol';
export type { AgentAdapter, AgentAdapterConfig, AdapterContext, AdapterResult } from './adapter';
export type { LockProtocolContext, LockInfo, TaskInfo } from './prompts/lock-protocol';
```

- [ ] **Step 3: Update orchestrator exports**

```typescript
// packages/orchestrator/src/index.ts
export { orchestratorConfig, TaskDecompositionSkill } from './agent';
export { AgentDispatchSkill } from './skills/agent-dispatch';
export { LockManagementSkill } from './skills/lock-management';
export type { DispatchInput, DispatchResult, DispatchContext } from './skills/agent-dispatch';
export type { LockManagementInput, LockManagementResult } from './skills/lock-management';
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 5: Run build**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: update exports and verify Phase 2 build"
```

---

## Summary

**Phase 2 Completed Tasks:**
1. AgentDispatchSkill - Dispatch tasks to agents with lock acquisition
2. LockManagementSkill - Unified lock management interface
3. Region Conflict Detector - Layer 2 conflict detection
4. Lock Protocol Prompts - Prompt templates for lock protocol
5. Task State Machine - Valid state transitions with history
6. Integration - Updated exports and verified build

**Next (Phase 3):**
- TaskReviewSkill
- DecisionLogSkill
- Two-stage review process
- Web Dashboard basic version