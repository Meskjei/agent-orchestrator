# 快速入门

本指南帮助您快速上手 Agent Orchestrator。

## 安装

### 前置要求

- Node.js 18+
- npm 10+

### 安装依赖

```bash
# 克隆仓库
git clone <repository-url>
cd Agent-Communication

# 安装依赖
npm install

# 构建所有软件包
npm run build
```

### 全局 CLI（可选）

```bash
# 全局链接 CLI
cd packages/cli
npm link
```

## 快速开始

### 1. 初始化项目

```bash
# 进入项目目录
cd /path/to/your-project

# 初始化 Agent Orchestrator
agent-orch init
```

这将创建：
- `.agent-orch/config.yaml` - 项目配置
- `.agent-orch/brain.json` - 共享项目状态
- `.agent-orch/agents/` - 代理配置目录

### 2. 注册代理

```bash
# 交互式添加代理
agent-orch agent add qoder

# 从配置文件添加代理
agent-orch agent add codex --config ./codex-config.yaml
```

### 3. 创建任务

```bash
# 交互式创建任务
agent-orch task create
```

### 4. 启动编排

```bash
# 启动编排系统
agent-orch start

# 启动终端 UI
agent-orch tui
```

## CLI 命令

| 命令 | 描述 |
|------|------|
| `agent-orch init` | 初始化项目，创建 `.agent-orch/` 目录 |
| `agent-orch agent add <name>` | 注册新代理 |
| `agent-orch agent add <name> -c <path>` | 从配置文件注册代理 |
| `agent-orch agent list` | 列出所有已注册代理 |
| `agent-orch task create` | 创建新任务 |
| `agent-orch start` | 启动编排 |
| `agent-orch tui` | 启动终端用户界面 |
| `agent-orch web` | 启动 Web 仪表板 |

## Web 仪表板

启动 Web 仪表板来监控和管理多代理协作：

```bash
agent-orch web
```

仪表板提供：

- **项目概览**：目标、进度和关键指标
- **任务看板**：支持拖拽的可视化任务板
- **代理状态**：实时代理状态和活动
- **文件锁**：锁定文件的可视化展示
- **决策日志**：所有决策的时间线
- **日志查看器**：实时日志流

### 仪表板功能

| 功能 | 描述 |
|------|------|
| 任务板 | 按状态显示所有任务的看板视图 |
| 代理监控 | 查看哪些代理在线、忙碌或离线 |
| 锁可视化 | 带锁状态指示器的文件树视图 |
| 实时日志 | WebSocket 驱动的实时日志流 |
| 决策时间线 | 项目决策的按时间顺序视图 |

## 配置

### 项目配置 (`config.yaml`)

```yaml
name: 我的项目
description: 项目描述
goal: 完成项目目标
version: "1.0.0"
```

### 代理配置 (`agents/<name>.yaml`)

```yaml
name: agent-name
description: 代理能力描述
type: cli  # 或 'api'
command: /path/to/agent-binary
cwd: /path/to/workspace
skills:
  - skill-id-1
  - skill-id-2
```

## ACP 客户端适配器

使用 ACP 协议与真实 AI 代理通信：

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
  task: '添加一个乘法函数',
  context: {}
});

console.log(result.output);
```

### 安装 opencode

```bash
npm install -g opencode-ai

# 登录认证
opencode auth login
```

## 测试

```bash
# 单元测试
npm test

# E2E 测试
npm run test:e2e

# ACP 集成测试
npm run test:acp
```

## 下一步

- 阅读 [架构设计](./architecture.md) 了解系统设计
- 查看 [API 参考](./api-reference.md) 了解 REST API 详情
- 探索 [原生卡片迁移示例](../examples/native-card-migration/)