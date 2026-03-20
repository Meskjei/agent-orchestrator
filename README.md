# Agent Orchestrator

AI 软件开发多代理协作系统。

## 功能特性

- 🤖 多代理编排
- 🧠 共享知识库
- 🔒 冲突预防
- 📊 仪表板（Web + TUI）
- 📝 决策日志
- 🔌 ACP 协议支持（opencode、claude code）

## 软件包

| 软件包 | 描述 |
|--------|------|
| @agent-orchestrator/core | 核心类型、知识库、锁、冲突检测 |
| @agent-orchestrator/orchestrator | 编排技能 |
| @agent-orchestrator/adapter | 代理适配器（CLI、ACP） |
| @agent-orchestrator/cli | CLI 命令和 TUI |
| @agent-orchestrator/web | Web 仪表板和 API |

## 快速开始

```bash
npm install
npm run build
npm test
```

## ACP 客户端适配器

通过 Agent Client Protocol 与真实 AI 代理通信：

```typescript
import { ACPClientAdapter } from '@agent-orchestrator/adapter';

const adapter = new ACPClientAdapter({
  name: 'opencode',
  command: 'opencode',
  args: ['acp'],
  cwd: '/path/to/project',
  timeout: 90000
});

const result = await adapter.execute({
  task: '在 math.js 中添加一个乘法函数',
  context: {}
});

console.log(result.output);
console.log('获取的锁:', result.locksAcquired);
```

### 支持的代理

| 代理 | 命令 | 状态 |
|------|------|------|
| opencode | `opencode acp` | ✅ 已验证 |
| claude code | `claude acp` | 🧪 实验性 |

## 文档

- [快速入门](docs/getting-started.md)
- [架构设计](docs/architecture.md)
- [API 参考](docs/api-reference.md)

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