# V2 架构实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Agent Orchestrator 升级为 v2 架构：独立 ACP Gateway 包 + Mastra Brain + 分层 Session

**Architecture:** 三层架构 — CLI(入口) → Brain(Mastra Agent) → ACP Gateway → Workers(opencode/claude)

**Tech Stack:** TypeScript, @agentclientprotocol/sdk, @mastra/core, pnpm workspaces, vitest

**Spec:** `docs/superpowers/specs/2026-03-20-v2-architecture-design.md`

---

## 文件结构总览

### 新建文件

| 文件 | 职责 |
|------|------|
| `packages/acp/package.json` | ACP Gateway 包配置 |
| `packages/acp/tsconfig.json` | TypeScript 配置 |
| `packages/acp/src/index.ts` | 包入口，导出 ACPGateway |
| `packages/acp/src/gateway.ts` | ACP Gateway 统一入口类 |
| `packages/acp/src/protocol/acp-client.ts` | 封装 @agentclientprotocol/sdk |
| `packages/acp/src/protocol/types.ts` | ACP 协议类型定义 |
| `packages/acp/src/pool/worker-pool.ts` | Worker 进程池管理 |
| `packages/acp/src/pool/worker.ts` | 单个 Worker 实例 |
| `packages/acp/src/lock/lock-manager.ts` | 文件锁管理 |
| `packages/acp/src/registry/agent-registry.ts` | Agent 注册/发现 |
| `packages/acp/src/__tests__/gateway.test.ts` | Gateway 单元测试 |
| `packages/acp/src/__tests__/worker-pool.test.ts` | Worker Pool 单元测试 |
| `packages/acp/src/__tests__/lock-manager.test.ts` | Lock Manager 单元测试 |
| `packages/orchestrator/src/brain.ts` | Mastra Agent 定义 |
| `packages/orchestrator/src/config.ts` | LLM 配置 |
| `packages/orchestrator/src/tools/acp-dispatch.ts` | Mastra Tool: 派发任务 |
| `packages/orchestrator/src/tools/acp-cancel.ts` | Mastra Tool: 取消任务 |
| `packages/orchestrator/src/tools/acp-status.ts` | Mastra Tool: 查询状态 |
| `packages/orchestrator/src/tools/acp-list-agents.ts` | Mastra Tool: 列出 Agent |
| `packages/orchestrator/src/tools/lock-query.ts` | Mastra Tool: 查询锁 |

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `packages/orchestrator/package.json` | 添加 @mastra/core, @agent-orchestrator/acp 依赖 |
| `packages/orchestrator/src/skills/task-decomposition.ts` | 转为 Mastra Skill |
| `packages/orchestrator/src/skills/agent-dispatch.ts` | 转为 Mastra Skill |
| `packages/orchestrator/src/skills/task-review.ts` | 转为 Mastra Skill |
| `pnpm-workspace.yaml` | 添加 packages/acp |
| `package.json` | 更新 scripts |

---

## Chunk 1: ACP Gateway 包

### Task 1.1: 创建包结构

**Files:**
- Create: `packages/acp/package.json`
- Create: `packages/acp/tsconfig.json`
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: 创建 packages/acp/package.json**

```json
{
  "name": "@agent-orchestrator/acp",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@agentclientprotocol/sdk": "latest",
    "@agent-orchestrator/core": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: 创建 packages/acp/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["src/__tests__"]
}
```

- [ ] **Step 3: 更新 pnpm-workspace.yaml**

添加 `packages/acp` 到 workspace。

- [ ] **Step 4: 安装依赖并验证构建**

```bash
pnpm install
cd packages/acp && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add packages/acp/package.json packages/acp/tsconfig.json pnpm-workspace.yaml
git commit -m "feat(acp): scaffold ACP Gateway package"
```

---

### Task 1.2: 类型定义

**Files:**
- Create: `packages/acp/src/protocol/types.ts`

- [ ] **Step 1: 定义核心类型**

```typescript
// packages/acp/src/protocol/types.ts

export interface AgentDescriptor {
  id: string;
  name: string;
  command: string;
  args: string[];
  capabilities: string[];
  maxWorkers: number;
}

export interface DispatchRequest {
  agentId: string;
  prompt: string;
  cwd: string;
  files?: string[];
  timeout?: number;
}

export interface DispatchResult {
  workerId: string;
  output: string;
  toolCalls: ToolCall[];
  locksAcquired: string[];
  locksReleased: string[];
  error?: string;
}

export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  timestamp: number;
}

export type WorkerStatus = 'pending' | 'running' | 'completed' | 'error' | 'timeout';

export interface LockStatus {
  file: string;
  locked: boolean;
  lockedBy?: string;
  lockedAt?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/acp/src/protocol/types.ts
git commit -m "feat(acp): add protocol type definitions"
```

---

### Task 1.3: ACP Protocol Client

**Files:**
- Create: `packages/acp/src/protocol/acp-client.ts`

- [ ] **Step 1: 封装 @agentclientprotocol/sdk**

从现有 `packages/adapter/src/acp-adapter.ts` 迁移协议实现。

```typescript
// packages/acp/src/protocol/acp-client.ts

import { spawn, ChildProcess } from 'child_process';
import { Writable, Readable } from 'stream';
import * as acp from '@agentclientprotocol/sdk';
import { ToolCall } from './types.js';

interface ACPClientOptions {
  command: string;
  args: string[];
  cwd: string;
  timeout: number;
}

interface ACPClientResult {
  output: string;
  toolCalls: ToolCall[];
  error?: string;
}

export class ACPProtocolClient {
  async execute(options: ACPClientOptions, prompt: string): Promise<ACPClientResult> {
    const proc = spawn(options.command, options.args, {
      cwd: options.cwd,
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    const toolCalls: ToolCall[] = [];
    const messages: string[] = [];

    const client = this.createClient(messages, toolCalls);
    const input = Writable.toWeb(proc.stdin!) as WritableStream<Uint8Array>;
    const output = Readable.toWeb(proc.stdout!) as ReadableStream<Uint8Array>;
    const stream = acp.ndJsonStream(input, output);
    const connection = new acp.ClientSideConnection(() => client, stream);

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), options.timeout);
      });

      await Promise.race([
        connection.initialize({
          protocolVersion: acp.PROTOCOL_VERSION,
          clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
        }),
        timeoutPromise,
      ]);

      const session = await Promise.race([
        connection.newSession({ cwd: options.cwd, mcpServers: [] }),
        timeoutPromise,
      ]);

      await Promise.race([
        connection.prompt({
          sessionId: session.sessionId,
          prompt: [{ type: 'text', text: prompt }],
        }),
        timeoutPromise,
      ]);

      return { output: messages.join(''), toolCalls };
    } catch (error) {
      return {
        output: messages.join(''),
        toolCalls,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      proc.kill();
    }
  }

  private createClient(messages: string[], toolCalls: ToolCall[]): acp.Client {
    return {
      async requestPermission(params) {
        return {
          outcome: { outcome: 'selected', optionId: params.options[0]?.optionId || '' },
        };
      },
      async sessionUpdate(params) {
        const update = params.update;
        if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
          messages.push(update.content.text);
        }
        if (update.sessionUpdate === 'tool_call') {
          toolCalls.push({ tool: update.title || update.toolCallId, input: {}, timestamp: Date.now() });
        }
      },
      async writeTextFile() { return {}; },
      async readTextFile() { return { content: '' }; },
    };
  }
}
```

- [ ] **Step 2: 创建入口文件**

```typescript
// packages/acp/src/index.ts
export { ACPGateway } from './gateway.js';
export { ACPProtocolClient } from './protocol/acp-client.js';
export type {
  AgentDescriptor,
  DispatchRequest,
  DispatchResult,
  ToolCall,
  WorkerStatus,
  LockStatus,
} from './protocol/types.js';
```

- [ ] **Step 3: Commit**

```bash
git add packages/acp/src/protocol/acp-client.ts packages/acp/src/index.ts
git commit -m "feat(acp): implement ACP protocol client"
```

---

### Task 1.4: Agent Registry

**Files:**
- Create: `packages/acp/src/registry/agent-registry.ts`

- [ ] **Step 1: 实现注册表**

```typescript
// packages/acp/src/registry/agent-registry.ts

import { AgentDescriptor } from '../protocol/types.js';

export class AgentRegistry {
  private agents = new Map<string, AgentDescriptor>();

  constructor() {
    this.register({
      id: 'opencode',
      name: 'OpenCode',
      command: 'opencode',
      args: ['acp'],
      capabilities: ['typescript', 'javascript', 'python'],
      maxWorkers: 3,
    });

    this.register({
      id: 'claude',
      name: 'Claude Code',
      command: 'claude',
      args: ['acp'],
      capabilities: ['typescript', 'javascript', 'python', 'swift'],
      maxWorkers: 2,
    });
  }

  register(descriptor: AgentDescriptor): void {
    this.agents.set(descriptor.id, descriptor);
  }

  unregister(agentId: string): void {
    this.agents.delete(agentId);
  }

  getAgent(agentId: string): AgentDescriptor | null {
    return this.agents.get(agentId) ?? null;
  }

  listAgents(): AgentDescriptor[] {
    return Array.from(this.agents.values());
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/acp/src/registry/agent-registry.ts
git commit -m "feat(acp): implement agent registry"
```

---

### Task 1.5: Worker Pool

**Files:**
- Create: `packages/acp/src/pool/worker.ts`
- Create: `packages/acp/src/pool/worker-pool.ts`

- [ ] **Step 1: 实现 Worker**

```typescript
// packages/acp/src/pool/worker.ts

import { ACPProtocolClient } from '../protocol/acp-client.js';
import { AgentDescriptor, DispatchRequest, DispatchResult, WorkerStatus } from '../protocol/types.js';

let nextWorkerId = 1;

export class Worker {
  readonly id: string;
  readonly agentId: string;
  status: WorkerStatus = 'pending';
  private client: ACPProtocolClient;

  constructor(agentId: string) {
    this.id = `worker-${nextWorkerId++}`;
    this.agentId = agentId;
    this.client = new ACPProtocolClient();
  }

  async run(descriptor: AgentDescriptor, request: DispatchRequest): Promise<DispatchResult> {
    this.status = 'running';

    const result = await this.client.execute(
      {
        command: descriptor.command,
        args: descriptor.args,
        cwd: request.cwd,
        timeout: request.timeout ?? 300000,
      },
      request.prompt,
    );

    this.status = result.error ? 'error' : 'completed';

    return {
      workerId: this.id,
      output: result.output,
      toolCalls: result.toolCalls,
      locksAcquired: [],
      locksReleased: [],
      error: result.error,
    };
  }

  cancel(): void {
    this.status = 'completed';
  }
}
```

- [ ] **Step 2: 实现 Worker Pool**

```typescript
// packages/acp/src/pool/worker-pool.ts

import { AgentRegistry } from '../registry/agent-registry.js';
import { Worker } from './worker.js';
import { DispatchRequest, DispatchResult } from '../protocol/types.js';

export class WorkerPool {
  private workers = new Map<string, Worker>();
  private registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  async dispatch(request: DispatchRequest): Promise<DispatchResult> {
    const descriptor = this.registry.getAgent(request.agentId);
    if (!descriptor) {
      return {
        workerId: '',
        output: '',
        toolCalls: [],
        locksAcquired: [],
        locksReleased: [],
        error: `Agent not found: ${request.agentId}`,
      };
    }

    const runningForAgent = Array.from(this.workers.values()).filter(
      (w) => w.agentId === request.agentId && w.status === 'running',
    ).length;

    if (runningForAgent >= descriptor.maxWorkers) {
      return {
        workerId: '',
        output: '',
        toolCalls: [],
        locksAcquired: [],
        locksReleased: [],
        error: `Agent ${request.agentId} has reached max workers (${descriptor.maxWorkers})`,
      };
    }

    const worker = new Worker(request.agentId);
    this.workers.set(worker.id, worker);

    const result = await worker.run(descriptor, request);

    this.workers.delete(worker.id);
    return result;
  }

  async cancel(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.cancel();
      this.workers.delete(workerId);
    }
  }

  getWorkerStatus(workerId: string) {
    return this.workers.get(workerId)?.status ?? null;
  }

  listWorkers() {
    return Array.from(this.workers.values()).map((w) => ({
      id: w.id,
      agentId: w.agentId,
      status: w.status,
    }));
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/acp/src/pool/worker.ts packages/acp/src/pool/worker-pool.ts
git commit -m "feat(acp): implement worker pool"
```

---

### Task 1.6: Lock Manager

**Files:**
- Create: `packages/acp/src/lock/lock-manager.ts`

- [ ] **Step 1: 实现文件锁管理**

```typescript
// packages/acp/src/lock/lock-manager.ts

import { LockStatus } from '../protocol/types.js';

export class LockManager {
  private locks = new Map<string, { workerId: string; lockedAt: number }>();

  acquire(files: string[], workerId: string): { granted: string[]; denied: string[] } {
    const granted: string[] = [];
    const denied: string[] = [];

    for (const file of files) {
      const existing = this.locks.get(file);
      if (existing && existing.workerId !== workerId) {
        denied.push(file);
      } else {
        this.locks.set(file, { workerId, lockedAt: Date.now() });
        granted.push(file);
      }
    }

    return { granted, denied };
  }

  release(files: string[], workerId: string): void {
    for (const file of files) {
      const existing = this.locks.get(file);
      if (existing?.workerId === workerId) {
        this.locks.delete(file);
      }
    }
  }

  releaseAll(workerId: string): void {
    for (const [file, lock] of this.locks.entries()) {
      if (lock.workerId === workerId) {
        this.locks.delete(file);
      }
    }
  }

  query(files: string[]): LockStatus[] {
    return files.map((file) => {
      const lock = this.locks.get(file);
      return {
        file,
        locked: !!lock,
        lockedBy: lock?.workerId,
        lockedAt: lock?.lockedAt,
      };
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/acp/src/lock/lock-manager.ts
git commit -m "feat(acp): implement lock manager"
```

---

### Task 1.7: ACP Gateway 统一入口

**Files:**
- Create: `packages/acp/src/gateway.ts`
- Modify: `packages/acp/src/index.ts`

- [ ] **Step 1: 实现 Gateway**

```typescript
// packages/acp/src/gateway.ts

import { AgentRegistry } from './registry/agent-registry.js';
import { WorkerPool } from './pool/worker-pool.js';
import { LockManager } from './lock/lock-manager.js';
import {
  AgentDescriptor,
  DispatchRequest,
  DispatchResult,
  LockStatus,
} from './protocol/types.js';

export class ACPGateway {
  readonly registry: AgentRegistry;
  private pool: WorkerPool;
  private lockManager: LockManager;

  constructor() {
    this.registry = new AgentRegistry();
    this.pool = new WorkerPool(this.registry);
    this.lockManager = new LockManager();
  }

  registerAgent(descriptor: AgentDescriptor): void {
    this.registry.register(descriptor);
  }

  listAgents(): AgentDescriptor[] {
    return this.registry.listAgents();
  }

  async dispatch(request: DispatchRequest): Promise<DispatchResult> {
    if (request.files?.length) {
      const { denied } = this.lockManager.acquire(request.files, 'pending');
      if (denied.length > 0) {
        return {
          workerId: '',
          output: '',
          toolCalls: [],
          locksAcquired: [],
          locksReleased: [],
          error: `Files locked: ${denied.join(', ')}`,
        };
      }
    }

    const result = await this.pool.dispatch(request);

    if (request.files?.length && result.workerId) {
      this.lockManager.release(request.files, result.workerId);
    }

    return result;
  }

  async cancel(workerId: string): Promise<void> {
    this.lockManager.releaseAll(workerId);
    await this.pool.cancel(workerId);
  }

  queryLock(files: string[]): LockStatus[] {
    return this.lockManager.query(files);
  }

  getWorkerStatus(workerId: string) {
    return this.pool.getWorkerStatus(workerId);
  }
}
```

- [ ] **Step 2: 更新 index.ts 导出**

```typescript
// packages/acp/src/index.ts
export { ACPGateway } from './gateway.js';
export { ACPProtocolClient } from './protocol/acp-client.js';
export { AgentRegistry } from './registry/agent-registry.js';
export { WorkerPool } from './pool/worker-pool.js';
export { LockManager } from './lock/lock-manager.js';
export type {
  AgentDescriptor,
  DispatchRequest,
  DispatchResult,
  ToolCall,
  WorkerStatus,
  LockStatus,
} from './protocol/types.js';
```

- [ ] **Step 3: Commit**

```bash
git add packages/acp/src/gateway.ts packages/acp/src/index.ts
git commit -m "feat(acp): implement ACP Gateway"
```

---

### Task 1.8: ACP Gateway 单元测试

**Files:**
- Create: `packages/acp/src/__tests__/gateway.test.ts`
- Create: `packages/acp/src/__tests__/lock-manager.test.ts`
- Create: `packages/acp/src/__tests__/registry.test.ts`

- [ ] **Step 1: Agent Registry 测试**

```typescript
// packages/acp/src/__tests__/registry.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry } from '../registry/agent-registry.js';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it('should have default agents registered', () => {
    const agents = registry.listAgents();
    expect(agents.length).toBe(2);
    expect(agents.map((a) => a.id)).toContain('opencode');
    expect(agents.map((a) => a.id)).toContain('claude');
  });

  it('should register new agent', () => {
    registry.register({
      id: 'test-agent',
      name: 'Test Agent',
      command: 'test',
      args: [],
      capabilities: ['typescript'],
      maxWorkers: 1,
    });
    expect(registry.getAgent('test-agent')?.name).toBe('Test Agent');
  });

  it('should unregister agent', () => {
    registry.unregister('opencode');
    expect(registry.getAgent('opencode')).toBeNull();
  });
});
```

- [ ] **Step 2: Lock Manager 测试**

```typescript
// packages/acp/src/__tests__/lock-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { LockManager } from '../lock/lock-manager.js';

describe('LockManager', () => {
  let manager: LockManager;

  beforeEach(() => {
    manager = new LockManager();
  });

  it('should acquire lock on free file', () => {
    const result = manager.acquire(['a.ts'], 'worker-1');
    expect(result.granted).toEqual(['a.ts']);
    expect(result.denied).toEqual([]);
  });

  it('should deny lock on already locked file', () => {
    manager.acquire(['a.ts'], 'worker-1');
    const result = manager.acquire(['a.ts'], 'worker-2');
    expect(result.denied).toEqual(['a.ts']);
  });

  it('should release locks', () => {
    manager.acquire(['a.ts'], 'worker-1');
    manager.release(['a.ts'], 'worker-1');
    const result = manager.acquire(['a.ts'], 'worker-2');
    expect(result.granted).toEqual(['a.ts']);
  });

  it('should query lock status', () => {
    manager.acquire(['a.ts'], 'worker-1');
    const status = manager.query(['a.ts', 'b.ts']);
    expect(status[0].locked).toBe(true);
    expect(status[1].locked).toBe(false);
  });
});
```

- [ ] **Step 3: Gateway 测试**

```typescript
// packages/acp/src/__tests__/gateway.test.ts
import { describe, it, expect } from 'vitest';
import { ACPGateway } from '../gateway.js';

describe('ACPGateway', () => {
  it('should list registered agents', () => {
    const gateway = new ACPGateway();
    const agents = gateway.listAgents();
    expect(agents.length).toBeGreaterThan(0);
  });

  it('should register custom agent', () => {
    const gateway = new ACPGateway();
    gateway.registerAgent({
      id: 'custom',
      name: 'Custom Agent',
      command: 'custom-cli',
      args: ['acp'],
      capabilities: ['python'],
      maxWorkers: 1,
    });
    expect(gateway.listAgents().map((a) => a.id)).toContain('custom');
  });

  it('should query lock status', () => {
    const gateway = new ACPGateway();
    const locks = gateway.queryLock(['a.ts']);
    expect(locks[0].locked).toBe(false);
  });
});
```

- [ ] **Step 4: 运行测试**

```bash
cd packages/acp && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add packages/acp/src/__tests__/
git commit -m "test(acp): add unit tests for gateway, registry, lock manager"
```

- [ ] **Step 6: 验证构建**

```bash
npm run build
cd packages/acp && pnpm test
```

- [ ] **Step 7: Commit 最终状态**

```bash
git add packages/acp/
git commit -m "feat(acp): complete ACP Gateway package"
```

---

## Chunk 2: Mastra 集成

### Task 2.1: 安装 Mastra 依赖

**Files:**
- Modify: `packages/orchestrator/package.json`

- [ ] **Step 1: 添加依赖**

```bash
cd packages/orchestrator
pnpm add @mastra/core @mastra/memory @agent-orchestrator/acp
pnpm add @ai-sdk/openai @ai-sdk/anthropic  # LLM providers
```

- [ ] **Step 2: Commit**

```bash
git add packages/orchestrator/package.json pnpm-lock.yaml
git commit -m "chore(orchestrator): add Mastra and ACP dependencies"
```

---

### Task 2.2: LLM 配置

**Files:**
- Create: `packages/orchestrator/src/config.ts`

- [ ] **Step 1: 实现可配置 LLM**

```typescript
// packages/orchestrator/src/config.ts

import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

export interface BrainLLMConfig {
  provider: 'anthropic' | 'openai' | 'local';
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export function createLLM(config: BrainLLMConfig) {
  switch (config.provider) {
    case 'anthropic':
      return anthropic(config.model ?? 'claude-sonnet-4-20250514', {
        apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
      });
    case 'openai':
      return openai(config.model ?? 'gpt-4o', {
        apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
      });
    case 'local':
      // 本地模型通过 openai-compatible provider
      return openai(config.model ?? 'llama3', {
        baseURL: config.baseUrl ?? 'http://localhost:11434/v1',
        apiKey: config.apiKey ?? 'ollama',
      });
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/orchestrator/src/config.ts
git commit -m "feat(orchestrator): add configurable LLM support"
```

---

### Task 2.3: Mastra Tools (桥接 Brain ↔ ACP Gateway)

**Files:**
- Create: `packages/orchestrator/src/tools/acp-dispatch.ts`
- Create: `packages/orchestrator/src/tools/acp-cancel.ts`
- Create: `packages/orchestrator/src/tools/acp-status.ts`
- Create: `packages/orchestrator/src/tools/acp-list-agents.ts`
- Create: `packages/orchestrator/src/tools/lock-query.ts`

- [ ] **Step 1: 实现 acp_dispatch tool**

```typescript
// packages/orchestrator/src/tools/acp-dispatch.ts

import { createTool } from '@mastra/core/tools';
import { ACPGateway, DispatchResult } from '@agent-orchestrator/acp';
import { z } from 'zod';

export function createDispatchTool(gateway: ACPGateway) {
  return createTool({
    id: 'acp-dispatch',
    description: '派发任务给 Worker Agent 执行。选择 agentId，提供任务 prompt 和工作目录。',
    inputSchema: z.object({
      agentId: z.string().describe('Agent ID，如 opencode, claude'),
      prompt: z.string().describe('要执行的任务描述'),
      cwd: z.string().describe('工作目录路径'),
      files: z.array(z.string()).optional().describe('需要锁定的文件列表'),
    }),
    execute: async (inputData) => {
      const result = await gateway.dispatch({
        agentId: inputData.agentId,
        prompt: inputData.prompt,
        cwd: inputData.cwd,
        files: inputData.files,
      });
      return result;
    },
  });
}
```

- [ ] **Step 2: 实现其他 tools**

```typescript
// packages/orchestrator/src/tools/acp-cancel.ts
import { createTool } from '@mastra/core/tools';
import { ACPGateway } from '@agent-orchestrator/acp';
import { z } from 'zod';

export function createCancelTool(gateway: ACPGateway) {
  return createTool({
    id: 'acp-cancel',
    description: '取消正在执行的 Worker',
    inputSchema: z.object({
      workerId: z.string().describe('Worker ID'),
    }),
    execute: async (inputData) => {
      await gateway.cancel(inputData.workerId);
      return { cancelled: true };
    },
  });
}

// packages/orchestrator/src/tools/acp-status.ts
import { createTool } from '@mastra/core/tools';
import { ACPGateway } from '@agent-orchestrator/acp';
import { z } from 'zod';

export function createStatusTool(gateway: ACPGateway) {
  return createTool({
    id: 'acp-status',
    description: '查询 Worker 的执行状态',
    inputSchema: z.object({
      workerId: z.string().describe('Worker ID'),
    }),
    execute: async (inputData) => {
      return { status: gateway.getWorkerStatus(inputData.workerId) };
    },
  });
}

// packages/orchestrator/src/tools/acp-list-agents.ts
import { createTool } from '@mastra/core/tools';
import { ACPGateway } from '@agent-orchestrator/acp';
import { z } from 'zod';

export function createListAgentsTool(gateway: ACPGateway) {
  return createTool({
    id: 'acp-list-agents',
    description: '列出所有可用的 Worker Agent 及其能力',
    inputSchema: z.object({}),
    execute: async () => {
      return { agents: gateway.listAgents() };
    },
  });
}

// packages/orchestrator/src/tools/lock-query.ts
import { createTool } from '@mastra/core/tools';
import { ACPGateway } from '@agent-orchestrator/acp';
import { z } from 'zod';

export function createLockQueryTool(gateway: ACPGateway) {
  return createTool({
    id: 'lock-query',
    description: '查询文件锁状态，判断文件是否被锁定',
    inputSchema: z.object({
      files: z.array(z.string()).describe('要查询的文件路径列表'),
    }),
    execute: async (inputData) => {
      return { locks: gateway.queryLock(inputData.files) };
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/orchestrator/src/tools/
git commit -m "feat(orchestrator): implement Mastra tools for ACP Gateway"
```

---

### Task 2.4: Mastra Brain Agent

**Files:**
- Create: `packages/orchestrator/src/brain.ts`

- [ ] **Step 1: 定义 Mastra Agent**

```typescript
// packages/orchestrator/src/brain.ts

import { Agent } from '@mastra/core/agent';
import { ACPGateway } from '@agent-orchestrator/acp';
import { BrainLLMConfig, createLLM } from './config.js';
import { createDispatchTool } from './tools/acp-dispatch.js';
import { createCancelTool } from './tools/acp-cancel.js';
import { createStatusTool } from './tools/acp-status.js';
import { createListAgentsTool } from './tools/acp-list-agents.js';
import { createLockQueryTool } from './tools/lock-query.js';

export interface BrainConfig {
  llm: BrainLLMConfig;
  maxConcurrentTasks: number;
}

export function createBrain(config: BrainConfig) {
  const gateway = new ACPGateway();
  const model = createLLM(config.llm);

  const dispatchTool = createDispatchTool(gateway);
  const cancelTool = createCancelTool(gateway);
  const statusTool = createStatusTool(gateway);
  const listAgentsTool = createListAgentsTool(gateway);
  const lockQueryTool = createLockQueryTool(gateway);

  const agent = new Agent({
    id: 'orchestrator-brain',
    name: 'Orchestrator Brain',
    instructions: `你是一个任务编排代理。你的职责是：
1. 分析复杂任务，分解为可执行的子任务
2. 根据 Agent 能力选择合适的 Worker
3. 分派任务并监控执行
4. 审查结果确保质量
5. 管理文件锁防止冲突

工作流程：
1. 使用 acp-list-agents 查看可用 Worker
2. 使用 lock-query 检查文件锁状态
3. 使用 acp-dispatch 派发任务给 Worker
4. 使用 acp-status 检查 Worker 执行状态
5. 使用 acp-cancel 取消不需要的 Worker`,
    model,
    tools: {
      dispatchTool,
      cancelTool,
      statusTool,
      listAgentsTool,
      lockQueryTool,
    },
  });

  return { agent, gateway };
}
```

- [ ] **Step 2: 更新 index.ts 导出**

```typescript
// packages/orchestrator/src/index.ts
export { createBrain } from './brain.js';
export type { BrainConfig } from './brain.js';
export { ACPGateway } from '@agent-orchestrator/acp';
```

- [ ] **Step 3: Commit**

```bash
git add packages/orchestrator/src/brain.ts packages/orchestrator/src/index.ts
git commit -m "feat(orchestrator): implement Mastra Brain Agent"
```

---

### Task 2.5: 更新 Skills

**Files:**
- Modify: `packages/orchestrator/src/skills/task-decomposition.ts`
- Modify: `packages/orchestrator/src/skills/agent-dispatch.ts`

- [ ] **Step 1: 将 TaskDecomposition 转为 Mastra Skill**

将硬编码的 `if (description.includes('迁移'))` 逻辑删除，改为由 Mastra Agent 的 LLM 自然地做任务分解。Skill 只定义输入/输出 schema。

- [ ] **Step 2: 将 AgentDispatch 转为 Mastra Skill**

原有的 dispatch 逻辑改为调用 `acp_dispatch` tool。Skill 只定义选择 Agent 的策略。

- [ ] **Step 3: Commit**

```bash
git add packages/orchestrator/src/skills/
git commit -m "refactor(orchestrator): convert skills to Mastra format"
```

---

### Task 2.6: 集成测试

**Files:**
- Create: `packages/orchestrator/src/__tests__/brain.test.ts`

- [ ] **Step 1: Brain + Gateway 集成测试**

测试 Brain 调用 ACP Gateway 的完整流程（使用 mock LLM）。

- [ ] **Step 2: 运行测试**

```bash
cd packages/orchestrator && pnpm test
```

- [ ] **Step 3: Commit**

```bash
git add packages/orchestrator/src/__tests__/
git commit -m "test(orchestrator): add brain integration tests"
```

---

## Chunk 3: CLI 和 Web 更新

### Task 3.1: 更新 CLI

**Files:**
- Modify: `packages/cli/src/` 中的相关文件

- [ ] **Step 1: CLI 调用 Brain**

CLI 只做入口，调用 Brain Agent 启动任务。

- [ ] **Step 2: Commit**

```bash
git add packages/cli/
git commit -m "refactor(cli): use Mastra Brain for task execution"
```

---

### Task 3.2: 更新 Web

**Files:**
- Modify: `packages/web/src/` 中的相关文件

- [ ] **Step 1: Web 展示 Brain 状态**

Web 从 Brain 获取任务状态、Worker 状态。

- [ ] **Step 2: Commit**

```bash
git add packages/web/
git commit -m "refactor(web): use Mastra Brain for status display"
```

---

## Chunk 4: 清理和文档

### Task 4.1: 标记旧 adapter

- [ ] **Step 1: 在旧 adapter 中添加 deprecated 标记**

在 `packages/adapter/src/acp-adapter.ts` 添加 JSDoc `@deprecated`。

- [ ] **Step 2: Commit**

```bash
git add packages/adapter/
git commit -m "deprecate(adapter): mark ACPClientAdapter as deprecated"
```

---

### Task 4.2: 更新文档

- [ ] **Step 1: 更新 README.md 和 docs/**

添加 v2 架构说明、新的包结构、使用示例。

- [ ] **Step 2: Commit**

```bash
git add README.md docs/
git commit -m "docs: update documentation for v2 architecture"
```

---

### Task 4.3: 全量验证

- [ ] **Step 1: 构建所有包**

```bash
npm run build
```

- [ ] **Step 2: 运行所有测试**

```bash
npm test
npm run test:e2e
```

- [ ] **Step 3: 最终 Commit**

```bash
git add -A
git commit -m "feat: complete v2 architecture migration"
```

---

## 实施顺序

| 阶段 | 任务 | 依赖 | 预计时间 |
|------|------|------|---------|
| 1 | ACP Gateway 包 (Task 1.1-1.8) | 无 | 2-3 小时 |
| 2 | Mastra 集成 (Task 2.1-2.6) | 阶段 1 完成 + Mastra API 调研 | 3-4 小时 |
| 3 | CLI/Web 更新 (Task 3.1-3.2) | 阶段 2 完成 | 1-2 小时 |
| 4 | 清理 (Task 4.1-4.3) | 阶段 3 完成 | 1 小时 |
