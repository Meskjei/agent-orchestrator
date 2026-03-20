# Agent Orchestrator v2 架构设计 Spec

**日期：** 2026-03-20
**状态：** 待审批

---

## 1. 设计目标

将 Agent Orchestrator 从硬编码逻辑升级为 **AI 驱动的智能编排系统**：
- 编排决策由 Mastra Agent（大模型）驱动，不再靠 `if/else`
- 统一 ACP 协议接入层，支持任意 ACP 兼容 Agent
- 支持一个大脑同时管理多个任务、多个 Worker 并发执行

---

## 2. 分层架构

```
用户
 │
 ▼
┌──────────────────────────────────────────────────────┐
│  CLI 层 (packages/cli)                               │
│  - 命令入口: task start / task list / task status    │
│  - 只负责投递任务和展示结果                            │
│  - 不参与任何编排逻辑                                  │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│  Brain 层 (packages/orchestrator, Mastra Agent)      │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  LLM 驱动的编排大脑                             │  │
│  │  - 分析任务 → 拆解为子任务                      │  │
│  │  - 根据 Worker 能力分配子任务                   │  │
│  │  - 审核 Worker 产出 → 通过/打回重做            │  │
│  │  - 处理冲突 → 决定阻塞/绕过                    │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Skills:                                        │  │
│  │  - TaskDecomposition: 分析需求，拆子任务        │  │
│  │  - AgentDispatch: 选择 Agent，派发子任务        │  │
│  │  - TaskReview: 审核产出质量                     │  │
│  │  - ConflictResolve: 处理文件/任务冲突           │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Tools (调用 ACP Gateway 的接口):               │  │
│  │  - acp_dispatch(agentId, prompt, cwd)           │  │
│  │  - acp_cancel(workerId)                         │  │
│  │  - acp_status(workerId)                         │  │
│  │  - acp_list_agents()                            │  │
│  │  - lock_query(files)                            │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────┘
                       │ tool_calls
                       ▼
┌──────────────────────────────────────────────────────┐
│  ACP Gateway 层 (packages/acp, 独立包)               │
│                                                      │
│  职责：纯执行，不决策                                  │
│  - 管理 Worker 进程池                                 │
│  - 转发 prompt，收集输出                              │
│  - 文件锁（进程级冲突解决）                            │
│  - 不知道"任务是什么"，只知道"发 prompt 给 Worker"    │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Worker Pool:                                   │  │
│  │  - opencode × 2  (可配置)                       │  │
│  │  - claude × 1    (可配置)                       │  │
│  │  - 自动管理进程生命周期                          │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Lock Manager:                                  │  │
│  │  - 文件级锁：a.ts → worker_1                    │  │
│  │  - 区域级锁：a.ts:10-50 → worker_1             │  │
│  │  - 自动释放：Worker 结束时释放其所有锁          │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  ACP Protocol:                                  │  │
│  │  - 基于 @agentclientprotocol/sdk                │  │
│  │  - JSON-RPC over stdio                          │  │
│  │  - 通用协议，不绑定特定 Agent                    │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────┘
                       │ stdio JSON-RPC
                       ▼
┌──────────────────────────────────────────────────────┐
│  Worker Agents (外部进程)                             │
│                                                      │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐          │
│  │ opencode  │ │ claude    │ │ 其他 ACP  │          │
│  │ acp       │ │ acp       │ │ 兼容 Agent│          │
│  └───────────┘ └───────────┘ └───────────┘          │
└──────────────────────────────────────────────────────┘
```

---

## 3. Session 管理

### 3.1 分层 Session 策略

```
Brain 进程 (Mastra Agent Instance)
├── Session A: "改写 Auth 模块" 任务
│   ├── Worker 1 (opencode, 改 login.ts)     ← 独立 ACP session
│   └── Worker 2 (claude, 改 register.ts)    ← 独立 ACP session
├── Session B: "重构 DB 层" 任务
│   └── Worker 3 (opencode, 改 db.ts)        ← 独立 ACP session
└── 全局状态: 锁表 + Worker 池
```

- **Brain 的 Session** = Mastra Agent 的上下文（每个用户任务一个 session）
- **Worker 的 Session** = ACP 协议的 session（每个 Worker 独立）
- **全局锁表** = 跨 Session 共享，Brain 查锁状态决定能否分派

### 3.2 Session 并发

- Brain 同时运行多个 Mastra Session（每个处理一个用户任务）
- 每个 Session 可以同时 dispatch 多个 Worker
- Worker 通过 ACP Gateway 的进程池管理，限制最大并发数

---

## 4. 核心流程

### 4.1 任务执行全流程

```
1. 用户: agent-orch task start "把 Auth 模块从 JS 迁移到 TS"
        │
        ▼
2. CLI: 把任务发给 Brain，等待结果
        │
        ▼
3. Brain Session 创建 (Mastra)
   ├── 3a. TaskDecomposition Skill:
   │   - LLM 分析任务 → 拆成子任务
   │   - 子任务: [分析 Auth 依赖, 迁移 login.ts, 迁移 register.ts, 迁移 types]
   │   - 依赖: login.ts 和 register.ts 无依赖可并行, types 需先完成
   │
   ├── 3b. Brain 调用 acp_list_agents() 查可用 Worker
   │
   ├── 3c. 对每个子任务，调用 AgentDispatch Skill:
   │   - Brain: "login.ts 迁移 → 选 opencode, 他会 TS"
   │   - 调用 acp_dispatch('opencode', '把 login.ts 从 JS 改为 TS', '/project')
   │   - ACP Gateway: 启动 opencode 进程, 发送 prompt, 返回结果
   │
   ├── 3d. 并发执行无依赖的子任务 (Promise.all):
   │   - Worker 1: opencode 迁移 login.ts
   │   - Worker 2: claude 迁移 register.ts
   │
   ├── 3e. 等待所有 Worker 完成
   │
   ├── 3f. TaskReview Skill:
   │   - LLM 审核每个 Worker 的产出
   │   - 通过 → 继续下一个子任务
   │   - 不通过 → 重新 dispatch 或修改 prompt
   │
   └── 3g. 所有子任务完成 → 汇总结果
        │
        ▼
4. CLI: 展示最终结果给用户
```

### 4.2 冲突处理流程

```
Brain 要 dispatch Worker 去改 a.ts
        │
        ▼
Brain 调用 lock_query(['a.ts'])
        │
        ├── a.ts 未锁定 → 调用 acp_dispatch() → Gateway 获取锁 → 执行
        ├── a.ts 被 worker_1 锁定 → Brain 决策:
        │   ├── 策略 A: 等待 (队列)
        │   ├── 策略 B: 改分配 (让其他 Worker 先做别的)
        │   └── 策略 C: 报告冲突，要求人工介入
```

---

## 5. 包结构

```
packages/
├── core/                    # 核心类型（不变）
│
├── acp/                     # 新：ACP Gateway 独立包
│   ├── package.json
│   └── src/
│       ├── index.ts                         # 导出 ACPGateway
│       ├── gateway.ts                       # 统一入口
│       ├── protocol/
│       │   └── acp-client.ts                # 封装 @agentclientprotocol/sdk
│       ├── pool/
│       │   ├── worker-pool.ts               # Worker 进程池
│       │   └── worker.ts                    # 单个 Worker 实例
│       ├── lock/
│       │   └── lock-manager.ts              # 文件锁管理
│       ├── registry/
│       │   └── agent-registry.ts            # Agent 注册/发现
│       └── __tests__/
│
├── orchestrator/            # 更新：Mastra Brain
│   ├── package.json         # 添加 @mastra/core 依赖
│   └── src/
│       ├── index.ts
│       ├── brain.ts                         # Mastra Agent 定义
│       ├── config.ts                        # LLM 可配置
│       ├── skills/
│       │   ├── task-decomposition.ts
│       │   ├── agent-dispatch.ts
│       │   ├── task-review.ts
│       │   └── conflict-resolve.ts
│       ├── tools/
│       │   ├── acp-dispatch.ts              # Mastra Tool → 调用 Gateway
│       │   ├── acp-cancel.ts
│       │   ├── acp-status.ts
│       │   ├── acp-list-agents.ts
│       │   └── lock-query.ts
│       └── __tests__/
│
├── cli/                     # 更新：只做入口
└── web/                     # 更新：只做展示
```

---

## 6. 关键接口

### 6.1 ACP Gateway 接口

```typescript
// packages/acp

interface ACPGateway {
  // 生命周期
  start(): Promise<void>;
  stop(): Promise<void>;

  // Agent 管理
  registerAgent(descriptor: AgentDescriptor): void;
  listAgents(): AgentDescriptor[];

  // Worker 管理
  dispatch(request: DispatchRequest): Promise<DispatchResult>;
  cancel(workerId: string): Promise<void>;
  status(workerId: string): WorkerStatus;

  // 锁
  queryLock(files: string[]): LockStatus[];
}

interface AgentDescriptor {
  id: string;               // 'opencode'
  name: string;             // 'OpenCode'
  command: string;          // 'opencode'
  args: string[];           // ['acp']
  capabilities: string[];   // ['typescript', 'python', 'swift']
  maxWorkers: number;       // 最大并发 Worker 数
}

interface DispatchRequest {
  agentId: string;
  prompt: string;
  cwd: string;
  files?: string[];         // 需要锁定的文件
  timeout?: number;
}

interface DispatchResult {
  workerId: string;
  output: string;
  toolCalls: ToolCall[];
  locksAcquired: string[];
  locksReleased: string[];
  error?: string;
}

// Worker 状态
type WorkerStatus = 'pending' | 'running' | 'completed' | 'error' | 'timeout';
```

### 6.2 Brain Tools 接口

```typescript
// Mastra Tool 定义 (桥接 Brain → Gateway)

const acpDispatchTool = createTool({
  id: 'acp_dispatch',
  description: '派发任务给 Worker Agent',
  inputSchema: z.object({
    agentId: z.string().describe('Agent ID，如 opencode'),
    prompt: z.string().describe('要执行的任务描述'),
    cwd: z.string().describe('工作目录'),
    files: z.array(z.string()).optional().describe('需要锁定的文件'),
  }),
  execute: async ({ context }) => {
    const result = await gateway.dispatch({
      agentId: context.agentId,
      prompt: context.prompt,
      cwd: context.cwd,
      files: context.files,
    });
    return JSON.stringify(result);
  },
});

const acpCancelTool = createTool({
  id: 'acp_cancel',
  description: '取消正在执行的 Worker',
  inputSchema: z.object({
    workerId: z.string(),
  }),
  execute: async ({ context }) => {
    await gateway.cancel(context.workerId);
    return 'Worker cancelled';
  },
});

const lockQueryTool = createTool({
  id: 'lock_query',
  description: '查询文件锁状态',
  inputSchema: z.object({
    files: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    const locks = gateway.queryLock(context.files);
    return JSON.stringify(locks);
  },
});
```

---

## 7. 新 Agent 接入

新增 ACP 兼容 Agent 只需：

```typescript
// 注册新 Agent（配置驱动，无需改代码）
gateway.registerAgent({
  id: 'my-agent',
  name: 'My Agent',
  command: 'my-agent-cli',
  args: ['acp'],
  capabilities: ['typescript'],
  maxWorkers: 2,
});
```

Brain 的 `acp_list_agents()` tool 会自动返回所有已注册的 Agent，LLM 根据能力选择。

---

## 8. LLM 配置

```typescript
// Brain 支持可配置的 LLM Provider
interface BrainConfig {
  llm: {
    provider: 'anthropic' | 'openai' | 'local';
    model?: string;          // 'claude-sonnet-4-20250514', 'gpt-4', etc.
    apiKey?: string;         // 从环境变量或配置文件读取
    baseUrl?: string;        // 本地模型用，如 'http://localhost:11434'
  };
  gateway: ACPGateway;
  maxConcurrentTasks: number;
}
```

---

## 9. 迁移计划

### 阶段 1：创建 ACP Gateway 包
- 将现有 `ACPClientAdapter` 的协议代码迁移为独立 `acp-client.ts`
- 实现 `AgentRegistry`
- 实现 `WorkerPool`（基于现有 `ConnectionPool`）
- 实现 `LockManager`（基于现有 `lock` 包）
- 实现 `ACPGateway` 统一入口
- 单元测试

### 阶段 2：集成 Mastra
- 安装 `@mastra/core`
- 定义 Mastra Agent + Skills
- 创建 ACP Tools（桥接 Brain ↔ Gateway）
- 将现有硬编码逻辑转为 Mastra Skill
- 集成测试

### 阶段 3：更新 CLI 和 Web
- CLI 改为只做入口，调用 Brain
- Web 改为展示 Brain 的状态
- E2E 测试

### 阶段 4：清理
- 标记旧 adapter 为 deprecated
- 更新文档（中文）

---

## 10. 依赖

```json
// packages/acp/package.json
{
  "name": "@agent-orchestrator/acp",
  "dependencies": {
    "@agentclientprotocol/sdk": "latest",
    "@agent-orchestrator/core": "workspace:*"
  }
}

// packages/orchestrator/package.json (更新)
{
  "dependencies": {
    "@agent-orchestrator/core": "workspace:*",
    "@agent-orchestrator/acp": "workspace:*",
    "@mastra/core": "latest"
  }
}
```

---

## 11. 开放问题

| 问题 | 建议 |
|------|------|
| Mastra Agent 具体 API？ | 需要调研 `@mastra/core` 的 Agent/Tool/Skill 定义 |
| Brain 重启后任务恢复？ | Session 持久化到 `.agent-orch/sessions/` |
| 锁冲突默认策略？ | 默认排队，可配置为拒绝 |
| Worker 超时处理？ | 默认 5 分钟，Brain 可覆盖 |
| 错误重试？ | Brain 决定，最多 3 次，换 Agent 重试 |
