# 架构设计

本文档描述 Agent Orchestrator 系统的架构设计。

## 系统概览

```
                                     ┌─────────────────────────────────┐
                                     │         人类用户                │
                                     │  (任务发布者 / 审批者)          │
                                     └───────────────┬─────────────────┘
                                                     │
                               ┌─────────────────────┼─────────────────────┐
                               │                     │                     │
                               ▼                     ▼                     ▼
                        ┌──────────┐          ┌──────────┐         ┌──────────┐
                        │   CLI    │          │   Web    │         │   API    │
                        │  界面    │          │  仪表板  │         │  服务器  │
                        └────┬─────┘          └────┬─────┘         └────┬─────┘
                             │                     │                    │
                             └─────────────────────┼────────────────────┘
                                                   │
                                                   ▼
                               ┌───────────────────────────────────────┐
                               │         编排代理 (Orchestrator)        │
                               │                                       │
                               │  ┌─────────────────────────────────┐  │
                               │  │       编排技能 (Skills)          │  │
                               │  │  - TaskDecompositionSkill       │  │
                               │  │  - AgentDispatchSkill           │  │
                               │  │  - LockManagementSkill          │  │
                               │  │  - TaskReviewSkill              │  │
                               │  │  - DecisionLogSkill             │  │
                               │  └─────────────────────────────────┘  │
                               └───────────────────┬───────────────────┘
                                                   │
                               ┌───────────────────┼───────────────────┐
                               │                   │                   │
                               ▼                   ▼                   ▼
                     ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
                     │  项目知识库      │  │  锁管理器       │  │  代理适配器      │
                     │  (共享状态)      │  │  (锁服务)       │  │  (CLI/API封装)  │
                     └─────────────────┘  └─────────────────┘  └─────────────────┘
```

## 核心组件

### 项目知识库 (Project Brain)

**项目知识库**是维护共享认知的层级，包含：

- **目标 (Goal)**：项目目标和成功标准
- **代理 (Agents)**：已注册的代理及其能力
- **任务 (Tasks)**：带有状态跟踪的层次化任务树
- **上下文 (Context)**：共享代码片段、输出和待处理问题
- **决策 (Decisions)**：项目期间做出的所有决策记录
- **锁 (Locks)**：活动文件锁和历史记录

### 锁管理器 (Lock Manager)

**锁管理器**防止并发修改冲突：

- 文件级和区域级锁定
- 独占和共享锁类型
- 自动锁过期（默认 30 分钟）
- 锁请求等待队列

### 代理适配器 (Agent Adapters)

**代理适配器**封装第三方代理（CLI 工具、API）以提供统一接口：

- **CliAdapter**：封装基于 CLI 的代理，通过 stdin/stdout 通信
- **ACPClientAdapter**：通过 JSON-RPC 与 ACP 兼容代理（opencode、claude code）通信
- 输入转换（上下文 → 代理提示）
- 输出解析（代理响应 → 结构化输出）
- 通过提示注入强制执行锁协议

#### ACP 协议

ACP（Agent Client Protocol）适配器实现与真实 AI 代理的通信：

```
┌──────────────────────────────────────────────────────────────┐
│                    Agent Orchestrator                        │
│                                                              │
│  ┌─────────────────┐    ┌─────────────────────────────────┐  │
│  │ ACPClientAdapter │───►│  opencode acp (子进程)          │  │
│  │                 │    │  JSON-RPC over stdio             │  │
│  │ - initialize()  │    │  - 会话管理                      │  │
│  │ - newSession()  │    │  - 提示执行                      │  │
│  │ - prompt()      │    │  - 工具调用处理                  │  │
│  └─────────────────┘    └─────────────────────────────────┘  │
│                                                              │
│  功能:                                                       │
│  - 锁协议提示注入                                            │
│  - 超时处理                                                  │
│  - 并发代理支持                                              │
│  - 工具调用跟踪                                              │
└──────────────────────────────────────────────────────────────┘
```

## 软件包

系统组织为五个软件包：

### `@agent-orchestrator/core`

核心类型和工具：

| 模块 | 用途 |
|------|------|
| `types` | Task、Agent、Lock、Brain 类型定义 |
| `brain` | 带持久化的 ProjectBrain 实现 |
| `lock/manager` | 锁获取、释放和查询 |
| `conflict/detector` | 路径、区域和语义冲突检测 |
| `task/state-machine` | 任务状态转换 |
| `logging` | 带过滤的结构化日志 |

### `@agent-orchestrator/orchestrator`

编排技能：

| 技能 | 用途 |
|------|------|
| `TaskDecompositionSkill` | 将复杂任务分解为子任务 |
| `AgentDispatchSkill` | 将任务分派给代理并处理锁 |
| `LockManagementSkill` | 为代理管理文件锁 |
| `TaskReviewSkill` | 根据规范审查任务输出 |
| `DecisionLogSkill` | 记录和查询项目决策 |

### `@agent-orchestrator/adapter`

代理适配器基础设施：

| 模块 | 用途 |
|------|------|
| `CliAdapter` | 封装基于 CLI 的代理 |
| `ACPClientAdapter` | 与 ACP 兼容代理（opencode、claude code）通信 |
| `ACPConnectionPool` | 管理可复用的子进程连接 |
| `Transformer` | 为代理转换输入/输出 |
| `LockInterceptor` | 解析并强制执行代理输出中的锁协议 |
| `prompts/lock-protocol` | 生成锁协议提示 |
| `acp/tools/lock-tools` | 用于代理集成的 MCP 锁工具 |

### `@agent-orchestrator/cli`

命令行界面：

| 命令 | 用途 |
|------|------|
| `init` | 初始化项目结构 |
| `agent add/list` | 管理代理 |
| `task create` | 创建任务 |
| `start` | 启动编排 |
| `tui` | 启动终端 UI |

### `@agent-orchestrator/web`

Web 仪表板服务器：

| 路由 | 用途 |
|------|------|
| `/api/tasks` | 任务 CRUD 操作 |
| `/api/agents` | 代理管理 |
| `/api/status` | 项目状态 |
| `/api/logs` | 日志流 (SSE) |

## 技能详解

### TaskDecompositionSkill

将复杂任务分解为可管理的子任务：

```typescript
const result = await skill.execute({
  taskDescription: "将 CardTableViewCell 迁移到 SwiftUI",
  goal: "完成迁移并保持功能",
  constraints: ["无破坏性更改", "保持测试通过"],
  availableAgents: brain.agents
});
// 返回: { subtasks, dependencies, assignments }
```

### AgentDispatchSkill

将任务分派给代理并自动管理锁：

```typescript
const result = await skill.execute({
  agentId: "qoder",
  task: taskNode,
  context: {
    projectGoal: "迁移到 SwiftUI",
    agentRole: "iOS 开发者",
    relevantCodeSnippets: [...],
    currentLocks: [...]
  }
});
// 返回: { status, output, locksAcquired, locksReleased }
```

### LockManagementSkill

管理文件锁以防止冲突：

```typescript
// 获取锁
await skill.execute({
  action: 'acquire',
  agentId: 'codex',
  taskId: 'T001',
  files: ['CardViewModel.swift']
});

// 释放锁
await skill.execute({
  action: 'release',
  agentId: 'codex',
  files: ['CardViewModel.swift']
});
```

### TaskReviewSkill

审查任务输出是否符合规范：

```typescript
const report = await skill.execute({
  task: taskNode,
  output: { summary, files, artifacts },
  reviewType: 'both'  // 规范 + 质量
});
// 返回: { passed, specReview, qualityReview, requiresHumanReview }
```

### DecisionLogSkill

记录和查询项目决策：

```typescript
await skill.execute({
  action: 'record',
  decision: {
    decision: "使用 SwiftUI 作为 UI 层",
    decider: "human",
    context: "架构评审",
    alternatives: ["UIKit", "React Native"],
    impact: ["所有 UI 组件", "测试策略"]
  }
});
```

## 锁机制

### 工作原理

1. **声明**：代理通过输出中的 `[DECLARE]` 声明修改文件的意图
2. **获取**：锁管理器检查冲突并授予/拒绝
3. **执行**：如果获得锁，代理继续修改
4. **释放**：代理完成后通过 `[RELEASE]` 释放锁

### 锁状态

```
┌─────────────┐     获取        ┌─────────────┐
│   等待中    │ ──────────────►  │   活跃      │
└─────────────┘                  └──────┬──────┘
                                        │
                       释放/过期        │
                              │         │
                              ▼         ▼
                        ┌─────────────┐
                        │   已释放    │
                        └─────────────┘
```

### 冲突检测层级

| 层级 | 检测方式 | 解决方案 |
|------|---------|---------|
| 路径 | 同文件修改 | 锁阻止访问 |
| 区域 | 重叠代码区域 | 区域锁或合并 |
| 语义 | 逻辑依赖 | 警报人工审查 |

## 任务状态机

```
                ┌─────────────┐
                │   pending   │
                │   等待中    │
                └──────┬──────┘
                       │ 依赖满足
                       ▼
                ┌─────────────┐
      ┌────────│    ready    │◄───────┐
      │        │    就绪     │        │
      │        └──────┬──────┘        │
      │               │ 分配           │ 重新分配
      │               ▼               │
      │        ┌─────────────┐        │
      │        │  assigned   │────────┘
      │        │   已分配    │
      │        └──────┬──────┘
      │               │ 开始
      │               ▼
      │        ┌─────────────┐
      │        │ executing   │◄───────┐
      │        │   执行中    │        │
      │        └──────┬──────┘        │
      │               │ 完成          │ 需要信息
      │               ▼               │
      │        ┌─────────────┐        │
      │        │  reviewing  │────────┘
      │        │   审查中    │
      │        └──────┬──────┘
      │               │
      │       ┌───────┴───────┐
      │       ▼               ▼
      │ ┌──────────┐   ┌───────────┐
      │ │ revision │   │ completed │
      │ │  修订    │   │   已完成  │
      │ └────┬─────┘   └───────────┘
      │      │ 重新提交
      │      └──────────────► reviewing
      │
      │ 阻塞
      ▼
 ┌─────────────┐
 │   blocked   │
 │   已阻塞    │
 └─────────────┘
```

## 数据持久化

所有项目状态持久化到 `.agent-orch/brain.json`：

```json
{
  "id": "uuid",
  "name": "项目名称",
  "version": "1.0.0",
  "goal": { "description": "...", "successCriteria": [], "constraints": [] },
  "agents": [...],
  "tasks": { "root": "...", "nodes": [...] },
  "context": { "background": "...", "codeSnippets": [], "outputs": [] },
  "decisions": [...],
  "locks": { "active": [], "history": [] }
}
```