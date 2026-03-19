# Agent Orchestrator 端到端测试计划设计

## 概述

本文档定义了 Agent Orchestrator 的端到端测试计划，采用分层测试架构，覆盖完整用户工作流场景。

## 测试目标

- **主目标**：验证用户完整工作流，从项目初始化到任务完成
- **环境**：真实环境，执行真实 CLI 命令、启动 Web 服务器、模拟真实用户操作
- **自动化程度**：完全自动化测试，可重复执行，集成到 CI/CD

## 测试场景覆盖

| 场景 | Layer | 描述 |
|------|-------|------|
| 单代理完整生命周期 | 1-4 | 初始化→注册代理→创建任务→分解→执行→审查→完成 |
| 多代理并发协作 | 1-4 | 多代理并发工作，锁竞争和释放，冲突检测和处理 |
| CLI/TUI 界面测试 | 2 | CLI 命令行界面和 TUI 终端界面的可用性 |
| Web 仪表板测试 | 3 | Web API 端点、仪表板功能和实时更新 |

## 验证标准

| 标准 | 说明 |
|------|------|
| 状态持久化正确 | 验证数据一致性和持久化正确性 |
| 并发安全无冲突 | 验证锁机制和冲突检测的有效性 |
| 错误处理完备 | 验证错误处理和恢复机制 |

---

## 分层测试架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Layer 4: E2E 场景层                       │
│  完整用户工作流测试（初始化→创建任务→分解→执行→审查→完成）    │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Layer 3: Web API 层                       │
│  REST API 端点测试、WebSocket 实时更新、仪表板功能            │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Layer 2: CLI 测试层                       │
│  真实 CLI 命令执行、文件系统操作、TUI 交互验证                │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Layer 1: 集成测试层                       │
│  ProjectBrain + LockManager + Skills + 模拟代理适配器        │
└─────────────────────────────────────────────────────────────┘
```

---

## Layer 1: 集成测试层

### 目标

验证核心组件（ProjectBrain、LockManager、Skills、ConflictDetector）协作正确性。

### 测试用例

| ID | 测试场景 | 验证点 |
|----|---------|--------|
| L1-01 | 单代理任务生命周期 | Brain 创建/保存/加载 → 任务状态转换 → 日志记录 |
| L1-02 | 锁获取与释放 | 独占锁获取 → 阻塞请求 → 队列处理 → 锁释放传递 |
| L1-03 | 三层冲突检测 | 路径冲突检测 → 区域重叠检测 → 语义冲突检测 |
| L1-04 | 技能协作流程 | 任务分解 → 代理调度 → 任务审查 → 决策记录 |
| L1-05 | 状态持久化验证 | Brain 保存后重新加载，数据完全一致 |
| L1-06 | 错误处理验证 | 无效操作返回明确错误信息 |

### 实现方式

- 使用真实的 ProjectBrainImpl、LockManager、ConflictDetector
- 代理适配器使用 shell `echo` 命令模拟
- 每个测试创建独立临时目录
- 测试间完全隔离，无共享状态

### 文件位置

- 现有文件：`tests/e2e/integration.test.ts`（已实现基础版本）
- 扩展：在现有文件中补充缺失场景

---

## Layer 2: CLI 测试层

### 目标

验证 CLI 命令正确执行、文件系统操作正确、输出格式符合预期。

### 测试用例

| ID | 命令 | 测试场景 | 验证点 |
|----|------|---------|--------|
| L2-01 | `init` | 初始化新项目 | `.agent-orch/` 目录结构正确创建 |
| L2-02 | `init` | 重复初始化 | 返回错误或提示已存在 |
| L2-03 | `agent add` | 注册代理 | 配置文件正确生成 |
| L2-04 | `agent list` | 列出代理 | 输出格式正确，包含所有已注册代理 |
| L2-05 | `agent add` | 注册已存在代理 | 返回错误 |
| L2-06 | `task create` | 创建任务 | Brain 中任务正确创建 |
| L2-07 | `task create` | 创建子任务 | 任务层级关系正确 |
| L2-08 | `start` | 启动编排 | 编排器正确初始化 |
| L2-09 | 无效命令 | 执行不存在的命令 | 返回非零退出码和错误信息 |
| L2-10 | 帮助信息 | `--help` 参数 | 显示正确的帮助文本 |

### 实现方式

- 使用 `child_process.spawn` 或 `child_process.exec` 执行真实 CLI 命令
- 每个测试场景创建独立的临时项目目录
- 验证：文件系统状态、命令 stdout/stderr、退出码

### 验证函数

```typescript
interface CliTestResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  files: Record<string, string>; // 文件路径 -> 内容
}

async function runCli(
  command: string, 
  args: string[], 
  cwd: string
): Promise<CliTestResult>
```

### 文件位置

- 新建：`tests/e2e/layer2-cli.test.ts`

---

## Layer 3: Web API 测试层

### 目标

验证 Web 服务器启动、REST API 端点功能、SSE 实时更新。

### 测试用例

| ID | API 端点 | HTTP 方法 | 测试场景 | 验证点 |
|----|----------|----------|---------|--------|
| L3-01 | `/api/tasks` | GET | 获取任务列表 | 返回 200，格式正确 |
| L3-02 | `/api/tasks` | POST | 创建任务 | 返回 201，任务正确创建 |
| L3-03 | `/api/tasks/:id` | GET | 获取单个任务 | 返回正确任务详情 |
| L3-04 | `/api/tasks/:id` | PUT | 更新任务状态 | 状态正确更新 |
| L3-05 | `/api/agents` | GET | 获取代理列表 | 返回所有已注册代理 |
| L3-06 | `/api/status` | GET | 获取项目状态 | 返回项目进度和状态 |
| L3-07 | `/api/logs` | GET (SSE) | 日志流连接 | WebSocket 连接成功 |
| L3-08 | `/api/logs` | GET (SSE) | 实时日志推送 | 日志事件正确推送 |
| L3-09 | 不存在路径 | GET | 404 处理 | 返回 404 状态码 |
| L3-10 | 无效请求体 | POST | 400 处理 | 返回 400 和错误信息 |

### 实现方式

- 启动真实 Web 服务器（随机可用端口）
- 使用 Node.js `fetch` 或 `supertest` 库发送 HTTP 请求
- SSE 使用 `EventSource` 客户端测试
- 测试前后正确启动和关闭服务器

### 验证函数

```typescript
interface WebTestContext {
  baseUrl: string;
  server: Server;
}

async function setupWebServer(projectDir: string): Promise<WebTestContext>
async function teardownWebServer(context: WebTestContext): Promise<void>
```

### 文件位置

- 新建：`tests/e2e/layer3-web.test.ts`

---

## Layer 4: E2E 场景层

### 目标

验证完整用户工作流，模拟真实用户使用场景。

### 场景 1: 单代理完整生命周期

**流程：**
```
初始化项目 → 注册代理 → 创建任务 → 分解任务 → 获取锁 → 执行任务 → 审查 → 完成 → 释放锁
```

**验证点：**
- [ ] `.agent-orch/` 目录结构正确
- [ ] Brain 状态在每个步骤正确流转
- [ ] 任务状态历史完整记录
- [ ] 锁正确获取和释放
- [ ] 日志正确记录所有操作
- [ ] 最终 Brain 保存的数据完整

**文件：** `tests/e2e/layer4-scenarios/single-agent-lifecycle.test.ts`

---

### 场景 2: 多代理并发协作

**流程：**
```
初始化项目 → 注册 3 个代理 → 创建 3 个相关任务（依赖关系）→ 并发获取锁 → 排队执行 → 全部完成
```

**验证点：**
- [ ] 代理注册正确
- [ ] 任务依赖关系正确设置
- [ ] 锁队列正确处理（第一个获取成功，后续进入队列）
- [ ] 锁释放后自动传递给下一个等待者
- [ ] 所有任务最终都完成
- [ ] 无实际文件冲突发生

**文件：** `tests/e2e/layer4-scenarios/multi-agent-concurrent.test.ts`

---

### 场景 3: 冲突检测与处理

**流程：**
```
初始化项目 → 代理 A 获取 file.ts 锁 → 代理 B 尝试修改同一文件 → 冲突被检测 → 等待或拒绝
```

**验证点：**
- [ ] 代理 A 成功获取锁
- [ ] 代理 B 获取锁请求被拒绝或进入队列
- [ ] 冲突检测结果正确
- [ ] 锁状态正确反映当前持有者

**文件：** `tests/e2e/layer4-scenarios/conflict-detection.test.ts`

---

### 场景 4: 错误恢复

**流程：**
```
执行任务中模拟失败 → 任务状态回退 → 重试 → 成功
```

**验证点：**
- [ ] 任务失败时状态正确更新
- [ ] 错误信息正确记录
- [ ] 任务可以重新执行
- [ ] 重试后状态正确流转到完成
- [ ] 锁在失败时正确释放或保留

**文件：** `tests/e2e/layer4-scenarios/error-recovery.test.ts`

---

## 测试基础设施

### 目录结构

```
tests/
├── e2e/
│   ├── integration.test.ts          # Layer 1 (现有，需扩展)
│   ├── layer2-cli.test.ts           # Layer 2 (新建)
│   ├── layer3-web.test.ts           # Layer 3 (新建)
│   ├── layer4-scenarios/            # Layer 4 (新建)
│   │   ├── single-agent-lifecycle.test.ts
│   │   ├── multi-agent-concurrent.test.ts
│   │   ├── conflict-detection.test.ts
│   │   └── error-recovery.test.ts
│   └── helpers/                     # 测试工具 (新建)
│       ├── fixture.ts               # 测试夹具和工具函数
│       ├── cli-runner.ts            # CLI 执行器
│       ├── web-server.ts            # Web 服务器管理
│       ├── assertions.ts            # 自定义断言
│       └── mock-agents/             # 模拟代理脚本
│           ├── success-agent.sh
│           ├── slow-agent.sh
│           ├── failing-agent.sh
│           └── lock-declare.sh
└── vitest.config.e2e.ts             # E2E 测试配置 (现有)
```

### 测试工具函数

#### fixture.ts

```typescript
// 创建临时测试目录
export async function createTempProject(name: string): Promise<string>

// 清理临时目录
export async function cleanupTempProject(dir: string): Promise<void>

// 创建测试 Brain
export async function createTestBrain(dir: string, config?: Partial<BrainConfig>): Promise<ProjectBrainImpl>

// 等待条件满足
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout?: number
): Promise<void>
```

#### cli-runner.ts

```typescript
export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCli(
  args: string[],
  options?: { cwd?: string; timeout?: number }
): Promise<CliResult>

export async function runCliExpectSuccess(
  args: string[],
  options?: { cwd?: string }
): Promise<CliResult>

export async function runCliExpectFailure(
  args: string[],
  options?: { cwd?: string }
): Promise<CliResult>
```

#### web-server.ts

```typescript
export interface WebServerContext {
  baseUrl: string;
  port: number;
}

export async function startWebServer(
  projectDir: string,
  port?: number
): Promise<WebServerContext>

export async function stopWebServer(context: WebServerContext): Promise<void>

export async function withWebServer<T>(
  projectDir: string,
  fn: (ctx: WebServerContext) => Promise<T>
): Promise<T>
```

#### assertions.ts

```typescript
// 验证 Brain 状态持久化
export async function assertBrainPersisted(
  dir: string,
  expected: Partial<BrainState>
): Promise<void>

// 验证目录结构
export async function assertDirectoryStructure(
  dir: string,
  expectedFiles: string[]
): Promise<void>

// 验证锁状态
export function assertLockStatus(
  lockManager: LockManager,
  file: string,
  expected: { locked: boolean; holder?: string }
): void

// 验证任务状态历史
export function assertTaskStatusHistory(
  task: TaskNode,
  expectedTransitions: Array<{ from: TaskStatus; to: TaskStatus }>
): void
```

### 模拟代理脚本

#### success-agent.sh

```bash
#!/bin/bash
echo "Agent started"
echo "[DECLARE] test.ts"
sleep 1
echo "Working on task..."
echo "[RELEASE] test.ts"
echo "Task completed successfully"
exit 0
```

#### slow-agent.sh

```bash
#!/bin/bash
echo "Agent started"
sleep 5
echo "Task completed"
exit 0
```

#### failing-agent.sh

```bash
#!/bin/bash
echo "Agent started"
echo "Error: Task failed" >&2
exit 1
```

#### lock-declare.sh

```bash
#!/bin/bash
echo "[DECLARE] $1"
echo "Lock declared for $1"
exit 0
```

---

## CI/CD 集成

### 测试阶段

| 阶段 | 运行内容 | 触发条件 | 超时时间 | 运行环境 |
|------|---------|---------|---------|---------|
| PR 检查 | Layer 1 + Layer 2 | 每次 PR | 5 分钟 | Ubuntu, macOS |
| 合并检查 | Layer 1-3 | 合并到 main | 10 分钟 | Ubuntu, macOS |
| 夜间测试 | 全部 Layer 1-4 | 每日凌晨 2:00 | 30 分钟 | Ubuntu, macOS, Windows |

### GitHub Actions 配置

```yaml
# .github/workflows/test.yml
name: Test

on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'

jobs:
  test-layer-1-2:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npx vitest run tests/e2e/integration.test.ts
      - run: npx vitest run tests/e2e/layer2-cli.test.ts

  test-layer-1-3:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npx vitest run tests/e2e/integration.test.ts
      - run: npx vitest run tests/e2e/layer2-cli.test.ts
      - run: npx vitest run tests/e2e/layer3-web.test.ts

  test-full:
    runs-on: ${{ matrix.os }}
    if: github.event_name == 'schedule'
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npx vitest run tests/e2e
```

---

## 测试数据管理

### 测试项目配置

```typescript
// tests/e2e/helpers/test-projects.ts
export const TEST_PROJECTS = {
  simple: {
    name: 'Simple Test Project',
    goal: {
      description: 'A simple test project for E2E testing',
      successCriteria: ['Tests pass'],
      constraints: []
    }
  },
  multiAgent: {
    name: 'Multi-Agent Test Project',
    goal: {
      description: 'A project with multiple agents',
      successCriteria: ['All agents complete tasks', 'No conflicts'],
      constraints: ['No breaking changes']
    }
  }
};
```

### 测试代理配置

```typescript
// tests/e2e/helpers/test-agents.ts
export const TEST_AGENTS = {
  successAgent: {
    id: 'success-agent',
    name: 'Success Agent',
    description: 'Always succeeds',
    skills: [{ id: 'test', name: 'Testing', tags: ['test'] }],
    command: './tests/e2e/helpers/mock-agents/success-agent.sh'
  },
  slowAgent: {
    id: 'slow-agent',
    name: 'Slow Agent',
    description: 'Takes 5 seconds',
    skills: [{ id: 'slow', name: 'Slow', tags: ['slow'] }],
    command: './tests/e2e/helpers/mock-agents/slow-agent.sh'
  },
  failingAgent: {
    id: 'failing-agent',
    name: 'Failing Agent',
    description: 'Always fails',
    skills: [{ id: 'fail', name: 'Fail', tags: ['fail'] }],
    command: './tests/e2e/helpers/mock-agents/failing-agent.sh'
  }
};
```

---

## 错误处理策略

### 测试失败处理

1. **失败隔离**：每个测试场景独立，一个失败不影响其他
2. **详细日志**：失败时输出完整的执行日志、文件状态、Brain 状态
3. **快照保存**：失败时保存临时目录快照供调试
4. **重试机制**：对网络相关测试（Web API）启用自动重试

### 清理策略

```typescript
// 确保测试后清理
afterEach(async () => {
  try {
    await cleanupTempProject(tempDir);
  } catch (e) {
    console.error('Cleanup failed:', e);
    // 记录但不抛出，避免影响其他测试
  }
});
```

---

## 测试报告

### 输出格式

- **控制台**：使用 vitest 内置 reporter
- **JSON 报告**：CI 环境生成 JSON 格式报告
- **HTML 报告**：夜间测试生成 HTML 报告供查看

### 报告内容

- 测试总数、通过数、失败数
- 每个测试的执行时间
- 失败测试的错误信息和堆栈
- 覆盖的代码行数（可选）

---

## 维护指南

### 添加新测试

1. 确定测试属于哪个 Layer
2. 在对应文件中添加测试用例
3. 如需新的工具函数，添加到 `helpers/` 目录
4. 更新本文档的测试用例表

### 更新测试

1. 当 API 变更时，更新对应测试
2. 当新增功能时，添加对应测试
3. 修复失败的测试，不要直接删除或跳过

### 删除测试

1. 只在功能被移除时删除对应测试
2. 记录删除原因

---

## 附录：测试清单

### Layer 1 清单

- [ ] L1-01: 单代理任务生命周期
- [ ] L1-02: 锁获取与释放
- [ ] L1-03: 三层冲突检测
- [ ] L1-04: 技能协作流程
- [ ] L1-05: 状态持久化验证
- [ ] L1-06: 错误处理验证

### Layer 2 清单

- [ ] L2-01: `init` 初始化项目
- [ ] L2-02: `init` 重复初始化
- [ ] L2-03: `agent add` 注册代理
- [ ] L2-04: `agent list` 列出代理
- [ ] L2-05: `agent add` 注册已存在代理
- [ ] L2-06: `task create` 创建任务
- [ ] L2-07: `task create` 创建子任务
- [ ] L2-08: `start` 启动编排
- [ ] L2-09: 无效命令处理
- [ ] L2-10: 帮助信息

### Layer 3 清单

- [ ] L3-01: GET /api/tasks
- [ ] L3-02: POST /api/tasks
- [ ] L3-03: GET /api/tasks/:id
- [ ] L3-04: PUT /api/tasks/:id
- [ ] L3-05: GET /api/agents
- [ ] L3-06: GET /api/status
- [ ] L3-07: GET /api/logs (SSE 连接)
- [ ] L3-08: GET /api/logs (实时推送)
- [ ] L3-09: 404 处理
- [ ] L3-10: 400 处理

### Layer 4 清单

- [ ] 场景 1: 单代理完整生命周期
- [ ] 场景 2: 多代理并发协作
- [ ] 场景 3: 冲突检测与处理
- [ ] 场景 4: 错误恢复