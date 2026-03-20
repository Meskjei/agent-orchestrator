# Agent Orchestrator

AI 软件开发多代理协作系统。

## 功能特性

- 🧠 **Mastra Brain** — LLM 驱动的智能编排大脑
- 🔌 **ACP Gateway** — 统一 ACP 协议接入层
- 🤖 多代理编排
- 🔒 冲突预防
- 📊 仪表板（Web + TUI）

## 软件包

| 软件包 | 描述 |
|--------|------|
| @agent-orchestrator/core | 核心类型、知识库、锁、冲突检测 |
| @agent-orchestrator/acp | **ACP Gateway** — 统一 ACP 协议接入层 |
| @agent-orchestrator/orchestrator | **Mastra Brain** — LLM 驱动的编排大脑 |
| @agent-orchestrator/adapter | 代理适配器（CLI、旧 ACP） |
| @agent-orchestrator/cli | CLI 命令和 TUI |
| @agent-orchestrator/web | Web 仪表板和 API |

## 架构

```
CLI → Brain (Mastra Agent) → ACP Gateway → Workers (opencode/claude)
```

- **Brain** 是 Mastra Agent，由 LLM 驱动做编排决策
- **ACP Gateway** 是独立平台层，管理 Worker 进程和文件锁
- **Worker** 是外部 AI 代理（opencode、claude code）

## 快速开始

```bash
npm install
npm run build
npm test
```

## 使用 Mastra Brain

```typescript
import { createBrain } from '@agent-orchestrator/orchestrator';

const { agent, gateway } = createBrain({
  llm: { provider: 'anthropic' },  // 可选: 'openai', 'local'
  maxConcurrentTasks: 3,
});

// Brain 会自动调用 ACP Gateway 的 tools:
// - acp-list-agents: 查看可用 Worker
// - acp-dispatch: 派发任务
// - lock-query: 查询文件锁
```

## 使用 ACP Gateway（独立）

```typescript
import { ACPGateway } from '@agent-orchestrator/acp';

const gateway = new ACPGateway();

// 查看可用 Agent
console.log(gateway.listAgents());  // [{ id: 'opencode', ... }, { id: 'claude', ... }]

// 派发任务
const result = await gateway.dispatch({
  agentId: 'opencode',
  prompt: '在 math.js 中添加乘法函数',
  cwd: '/project',
});

console.log(result.output);
```

### 支持的代理

| 代理 | 命令 | 状态 |
|------|------|------|
| opencode | `opencode acp` | ✅ 已验证 |
| claude code | `claude acp` | 🧪 实验性 |

新增代理只需配置，无需改代码。

## 文档

- [快速入门](docs/getting-started.md)
- [架构设计](docs/architecture.md)
- [API 参考](docs/api-reference.md)
- [v2 架构设计 Spec](docs/superpowers/specs/2026-03-20-v2-architecture-design.md)
- [实施计划](docs/superpowers/plans/2026-03-20-v2-architecture-plan.md)

## 测试

```bash
# 单元测试
npm test

# E2E 测试（需要安装 opencode）
npm run test:e2e

# ACP 集成测试
npm run test:acp
```

## 许可证

MIT