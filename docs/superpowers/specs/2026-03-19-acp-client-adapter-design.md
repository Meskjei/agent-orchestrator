# ACP Client Adapter 设计文档

## 概述

实现 Agent Client Protocol (ACP) Client Adapter，使 Agent Orchestrator 能够与真实 AI agent（如 opencode、claude code）进行标准化通信，支持多 agent 协作和文件锁协议。

## 背景

### 当前问题

1. 现有 `CliAdapter` 只能通过 CLI 启动 agent，无法进行双向通信
2. 锁协议 `[DECLARE]/[RELEASE]` 依赖文本解析，不可靠
3. 无法获取 agent 执行过程中的中间状态
4. 无法支持多 session 并发

### ACP 协议

Agent Client Protocol 是连接编辑器与 AI agent 的标准协议：
- 基于 JSON-RPC over stdio
- 支持流式响应和工具调用
- 提供 TypeScript SDK `@agentclientprotocol/sdk`
- 已被 opencode、claude code、cursor 等主流 agent 支持

## 目标

1. 实现 ACP Client Adapter，支持与任何 ACP 兼容 agent 通信
2. 通过 MCP Tools 机制实现可靠的锁协议
3. 支持多 agent 并发执行
4. 提供完整的 E2E 测试覆盖

## 架构设计

### 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Orchestrator                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Orchestrator Agent (编排器)                 │   │
│  │  - TaskDecompositionSkill                                │   │
│  │  - AgentDispatchSkill                                    │   │
│  │  - LockManagementSkill                                   │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              ACP Adapter Layer                           │   │
│  │  ┌─────────────────┐  ┌─────────────────┐                │   │
│  │  │ ACPClientAdapter│  │ ACPConnection   │                │   │
│  │  │ - execute()     │  │ - stdio         │                │   │
│  │  │ - getStatus()   │  │ - session mgmt  │                │   │
│  │  │ - cancel()      │  │                 │                │   │
│  │  └────────┬────────┘  └────────┬────────┘                │   │
│  └───────────┼────────────────────┼─────────────────────────┘   │
└──────────────┼────────────────────┼─────────────────────────────┘
               │                    │
               │ JSON-RPC over stdio│
               ▼                    ▼
        ┌──────────────┐     ┌──────────────┐
        │ opencode acp │     │ claude code  │
        │ (ACP Server) │     │ (ACP Server) │
        └──────────────┘     └──────────────┘
```

### 组件职责

| 组件 | 职责 |
|------|------|
| ACPClientAdapter | 实现 AgentAdapter 接口，封装 ACP 通信逻辑 |
| ACPConnection | 管理 subprocess 和 JSON-RPC 连接 |
| ACPConnectionPool | 连接复用和并发控制 |
| LockTools | MCP Tools 定义，实现锁协议 |

## 详细设计

### 接口定义

```typescript
// packages/adapter/src/adapter.ts

export interface AgentAdapterConfig {
  name: string;
  description?: string;
  command: string;              // e.g., 'opencode', 'claude'
  args?: string[];              // e.g., ['acp']
  cwd?: string;
  timeout?: number;             // 默认 300000ms
  env?: Record<string, string>;
  model?: string;               // 可选：指定模型
  skills?: Skill[];
}

export interface AgentAdapter {
  config: AgentAdapterConfig;
  execute(context: AdapterContext): Promise<AdapterResult>;
  getStatus(): Promise<{ online: boolean; error?: string }>;
  cancel?(): Promise<void>;
}

export interface AdapterResult {
  output: string;
  artifacts?: string[];
  error?: string;
  locksAcquired?: string[];
  locksReleased?: string[];
  toolCalls?: ToolCallRecord[];
}

export interface AdapterContext {
  task: string;
  context: {
    projectGoal?: string;
    agentRole?: string;
    codeSnippets?: Array<{ file: string; content: string; language: string }>;
    locks?: Array<{ file: string; holder: string }>;
    [key: string]: unknown;
  };
}
```

### ACPClientAdapter 实现

```typescript
// packages/adapter/src/acp-adapter.ts

import { ClientSideConnection } from '@agentclientprotocol/sdk';
import { AgentAdapter, AgentAdapterConfig, AdapterContext, AdapterResult } from './adapter';
import { ACPConnectionPool } from './acp/connection';
import { createLockTools } from './acp/tools/lock-tools';
import { LOCK_PROTOCOL_PROMPT } from './prompts/lock-protocol';

export class ACPClientAdapter implements AgentAdapter {
  config: AgentAdapterConfig;
  private connectionPool: ACPConnectionPool;

  constructor(config: AgentAdapterConfig, connectionPool: ACPConnectionPool) {
    this.config = { timeout: 300000, ...config };
    this.connectionPool = connectionPool;
  }

  async execute(context: AdapterContext): Promise<AdapterResult> {
    const connection = await this.connectionPool.getConnection(this.config);
    
    // 创建 session
    const sessionId = await connection.createSession({
      cwd: this.config.cwd,
      model: this.config.model
    });

    // 构建完整 prompt
    const fullPrompt = LOCK_PROTOCOL_PROMPT + '\n\n' + context.task;

    // 跟踪锁状态
    const locksAcquired: string[] = [];
    const locksReleased: string[] = [];
    const toolCalls: ToolCallRecord[] = [];

    // 注册锁工具回调
    const lockTools = createLockTools({
      onDeclare: (files) => locksAcquired.push(...files),
      onRelease: (files) => locksReleased.push(...files)
    });

    try {
      // 发送 prompt
      const response = await connection.sendPrompt(sessionId, fullPrompt, {
        tools: lockTools,
        timeout: this.config.timeout
      });

      // 收集结果
      return {
        output: response.content,
        locksAcquired,
        locksReleased,
        toolCalls,
        artifacts: response.artifacts
      };
    } catch (error) {
      return {
        output: '',
        error: error instanceof Error ? error.message : String(error),
        locksAcquired,
        locksReleased
      };
    } finally {
      await connection.closeSession(sessionId);
    }
  }

  async getStatus(): Promise<{ online: boolean; error?: string }> {
    try {
      const connection = await this.connectionPool.getConnection(this.config);
      return { online: true };
    } catch (error) {
      return { 
        online: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  async cancel(): Promise<void> {
    // 取消当前执行
    this.connectionPool.cancelCurrent(this.config.name);
  }
}
```

### 锁协议实现

**双重保障策略：MCP Tools + Prompt 注入**

```typescript
// packages/adapter/src/acp/tools/lock-tools.ts

export interface LockToolsCallbacks {
  onDeclare: (files: string[]) => Promise<void>;
  onRelease: (files: string[]) => Promise<void>;
}

export function createLockTools(callbacks: LockToolsCallbacks) {
  return {
    lock_declare: {
      name: 'lock_declare',
      description: 'Declare intent to modify files. MUST be called before modifying any file.',
      inputSchema: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Absolute paths of files to lock'
          }
        },
        required: ['files']
      },
      handler: async (params: { files: string[] }) => {
        await callbacks.onDeclare(params.files);
        return { success: true, files: params.files };
      }
    },
    lock_release: {
      name: 'lock_release',
      description: 'Release file locks after modifications are complete.',
      inputSchema: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Absolute paths of files to release'
          }
        },
        required: ['files']
      },
      handler: async (params: { files: string[] }) => {
        await callbacks.onRelease(params.files);
        return { success: true, files: params.files };
      }
    }
  };
}
```

```typescript
// packages/adapter/src/prompts/lock-protocol.ts

export const LOCK_PROTOCOL_PROMPT = `
## MANDATORY LOCK PROTOCOL

You are working in a multi-agent environment. Before modifying ANY file, you MUST follow this protocol:

### Step 1: Declare Lock
Call the \`lock_declare\` tool before making changes:
\`\`\`
lock_declare({ files: ["/absolute/path/to/file.ts"] })
\`\`\`

### Step 2: Make Changes
Perform your file modifications using available tools (edit, write, etc.)

### Step 3: Release Lock
After completing modifications, call \`lock_release\`:
\`\`\`
lock_release({ files: ["/absolute/path/to/file.ts"] })
\`\`\`

### Why This Matters
- Prevents conflicts with other agents working on the same files
- Ensures coordinated multi-agent collaboration
- Failure to follow this protocol may cause your changes to be rejected

Always use absolute file paths when calling these tools.
`;
```

### 连接管理

```typescript
// packages/adapter/src/acp/connection.ts

import { spawn, ChildProcess } from 'child_process';
import { ClientSideConnection } from '@agentclientprotocol/sdk';

export class ACPConnectionPool {
  private connections: Map<string, ClientSideConnection> = new Map();
  private processes: Map<string, ChildProcess> = new Map();

  async getConnection(config: AgentAdapterConfig): Promise<ClientSideConnection> {
    const key = this.getConnectionKey(config);
    
    if (this.connections.has(key)) {
      return this.connections.get(key)!;
    }

    // 启动 subprocess
    const proc = spawn(config.command, config.args || [], {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // 建立 JSON-RPC 连接
    const connection = new ClientSideConnection({
      input: proc.stdout!,
      output: proc.stdin!
    });

    // 初始化连接
    await connection.initialize({
      clientInfo: {
        name: 'agent-orchestrator',
        version: '1.0.0'
      }
    });

    this.connections.set(key, connection);
    this.processes.set(key, proc);

    return connection;
  }

  async close(name: string): Promise<void> {
    const key = this.getConnectionKeyByName(name);
    const proc = this.processes.get(key);
    const conn = this.connections.get(key);

    if (conn) {
      await conn.shutdown();
      this.connections.delete(key);
    }

    if (proc) {
      proc.kill();
      this.processes.delete(key);
    }
  }

  private getConnectionKey(config: AgentAdapterConfig): string {
    return `${config.command}:${config.cwd || process.cwd()}`;
  }

  private getConnectionKeyByName(name: string): string {
    for (const [key] of this.connections) {
      if (key.startsWith(name)) return key;
    }
    return name;
  }
}
```

### 执行流程

```
1. AgentDispatchSkill.execute({ agentId, task, context })
   │
   ▼
2. ACPClientAdapter.execute(taskPrompt)
   │
   ├─► 获取/创建 ACP 连接
   ├─► createSession() 创建新 session
   ├─► 注册锁工具回调
   │
   ├─► sendPrompt() 发送任务 (含锁协议 prompt)
   │    │
   │    │  ◄── 流式响应 ──►
   │    │    - text: 文本输出
   │    │    - tool_use: lock_declare ──► onDeclare()
   │    │    - tool_use: read/write/edit
   │    │    - tool_use: lock_release ──► onRelease()
   │    │
   ├─► 收集结果
   ├─► closeSession() 关闭 session
   │
   ▼
3. 返回 AdapterResult
   {
     output: "任务完成",
     locksAcquired: ["src/feature.ts"],
     locksReleased: ["src/feature.ts"],
     toolCalls: [...]
   }
```

### 错误处理

| 场景 | 处理方式 |
|------|----------|
| Agent 启动失败 | 返回 `error: "Failed to start agent: ..."` |
| 锁获取失败 | 触发 `onDeclare` 时由 LockManager 返回错误，传递给 agent |
| Agent 超时 | 调用 `cancel()`，强制终止进程，返回 timeout 错误 |
| Agent 崩溃 | 捕获 exit code，清理资源，返回错误 |
| Session 创建失败 | 返回错误，不重试 |

## 文件结构

```
packages/adapter/src/
├── adapter.ts                    # 接口定义
├── acp-adapter.ts                # ACP adapter 实现
├── acp/
│   ├── connection.ts             # 连接池管理
│   └── tools/
│       ├── index.ts              # 工具注册
│       └── lock-tools.ts         # 锁工具定义
├── prompts/
│   └── lock-protocol.ts          # 锁协议 prompt
├── lock-interceptor.ts           # 锁拦截器 (现有，可复用)
└── transformer.ts                # 输入输出转换 (现有，可复用)

packages/adapter/src/__tests__/
├── acp-adapter.test.ts           # 单元测试
└── acp-integration.test.ts       # 集成测试
```

## 测试策略

### 单元测试

- Mock `ClientSideConnection`，测试 ACPClientAdapter 内部逻辑
- 测试锁工具回调触发
- 测试超时处理
- 测试错误场景

### 集成测试

- 连接真实 `opencode acp`
- 测试 session 创建和关闭
- 测试 prompt 发送和响应接收

### E2E 测试场景

1. **简单任务执行**：发送 "What is 2+2?"，验证返回 "4"
2. **文件修改 + 锁协议**：修改 math.js，验证锁声明和释放
3. **并发冲突**：两个 agent 同时修改同一文件，验证锁冲突处理
4. **超时处理**：设置短超时，验证 cancel 被正确调用
5. **错误恢复**：模拟 agent 崩溃，验证资源清理

### CI 配置

```yaml
# .github/workflows/test-acp.yml
name: ACP Integration Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test-acp:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install opencode
        run: npm install -g opencode-ai
      
      - name: Configure AI provider
        run: |
          mkdir -p ~/.config/opencode
          echo '{"providers":{"anthropic":{"apiKey":"${{ secrets.ANTHROPIC_API_KEY }}"}}}' > ~/.config/opencode/.opencode.json
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Run ACP tests
        run: npm run test:acp
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## 依赖

### 新增依赖

```json
{
  "dependencies": {
    "@agentclientprotocol/sdk": "^0.11.0"
  }
}
```

### 支持的 Agent

| Agent | 命令 | 状态 |
|-------|------|------|
| opencode | `opencode acp` | 已验证可用 |
| claude code | `claude acp` | 待验证 |
| cursor | 待确认 | 待验证 |

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| ACP SDK API 变更 | 适配器需要修改 | 锁定 SDK 版本，监控 changelog |
| Agent 不调用锁工具 | 锁协议失效 | Prompt 强制要求 + 检测未锁定的文件修改 |
| Agent 响应超时 | 任务卡住 | 设置合理超时 + cancel 机制 |
| 并发连接资源泄漏 | 内存泄漏 | ACPConnectionPool 统一管理 + 清理机制 |

## 后续优化

1. **连接复用**：多个任务复用同一个 ACP 连接，减少启动开销
2. **Session 持久化**：支持恢复中断的 session
3. **监控指标**：收集执行时间、token 使用量等指标
4. **更多 Agent 支持**：验证并支持 cursor、windsurf 等