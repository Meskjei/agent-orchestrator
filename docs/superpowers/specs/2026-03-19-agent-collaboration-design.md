# Multi-Agent Collaboration System Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an orchestration system that enables multiple AI agents (Qoder, Codex, iFlow, Claude) to collaborate autonomously on Native Card migration project.

**Architecture:** Orchestrator Agent (Mastra) coordinates multiple A2A-compliant agents via Agent Adapters, with shared cognition through Project Brain, conflict prevention via lock mechanism, and human-in-the-loop via CLI + Web interface.

**Tech Stack:** Mastra (orchestration), A2A Protocol (agent communication), TypeScript, JSON-RPC 2.0, WebSocket (real-time updates)

---

## 1. 项目背景与目标

### 问题场景

公司 APP 中的卡片功能原本用 Native (Objective-C) 实现，现需迁移到新技术栈。当前流程：

1. 人在 Native 仓库用 Qoder 分析代码
2. 手动复制信息到新仓库
3. 人在新仓库用 CODEX 实现新代码
4. 反复沟通、审查、迭代

**痛点：**
- 信息传递靠手动复制粘贴
- 多 Agent 之间无法直接协作
- 缺乏统一的任务追踪和状态共享
- 冲突和重复工作难以避免

### 目标

构建一个多 Agent 协作系统：

1. **自主协作**：多个 Agent 能自主分工、协作、交接
2. **共享认知**：所有 Agent 都明白目标、角色、进度
3. **人机协同**：人作为任务发布者、审批者、仲裁者
4. **冲突避免**：通过锁机制和冲突检测防止并行冲突

---

## 2. 技术选型

### 通信协议选择

| 协议 | 用途 | 是否适用 |
|------|------|----------|
| ACP (Agent Client Protocol) | Editor ↔ Agent (stdin/stdout) | ❌ 不适用 |
| A2A (Agent-to-Agent Protocol) | Agent ↔ Agent (HTTP/JSON-RPC) | ✅ 选用 |

**选择 A2A 的原因：**
- JSON-RPC 2.0 over HTTP，标准化程度高
- AgentCard 机制支持能力发现
- 支持同步、流式(SSE)、异步通知
- 已有成熟的 SDK (Python, Go, JS, Java, .NET)

### 编排框架选择

**选用 Mastra** 构建 Orchestrator Agent：
- TypeScript 原生支持
- 内置 Agent、Skill、Tool 概念
- 支持复杂的任务编排逻辑
- 社区活跃，文档完善

---

## 3. Orchestrator Agent 设计

### 核心职责

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator Agent                       │
│                        (Mastra)                             │
├─────────────────────────────────────────────────────────────┤
│  1. 接收人类指令（CLI / Web）                                │
│  2. 分解任务为子任务                                         │
│  3. 分配任务给合适的 Agent                                   │
│  4. 监控任务执行状态                                         │
│  5. 检测和处理冲突                                           │
│  6. 协调 Agent 之间的信息传递                                │
│  7. 汇报进度和请求人类决策                                   │
│  8. 维护 Project Brain（共享认知）                           │
└─────────────────────────────────────────────────────────────┘
```

### Orchestrator Skills

| Skill | 职责 | 输入 | 输出 |
|-------|------|------|------|
| TaskDecompositionSkill | 分解复杂任务 | 任务描述 | 子任务列表 |
| AgentDispatchSkill | 调度 Agent 执行任务 | Agent + 任务 | 执行结果 |
| ConflictDetectionSkill | 检测潜在冲突 | 文件修改列表 | 冲突报告 |
| LockManagementSkill | 管理文件锁 | 锁请求 | 锁状态 |
| TaskReviewSkill | 审查任务结果 | 任务 + 产出 | 审查报告 |
| DecisionLogSkill | 记录决策 | 决策内容 | 决策记录 |

---

## 4. Agent Adapter 模式

### 问题

第三方 Agent (Qoder, Codex, iFlow) 不是 A2A 原生实现，需要包装。

### 解决方案

```
┌──────────────────────────────────────────────────────────────┐
│                      Agent Adapter                           │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │ A2A Server  │◄───│ Transformer │◄───│ Third-party     │  │
│  │ (HTTP/JSON) │    │ (Input/Out) │    │ Agent (CLI/API) │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Agent 配置文件 (agent.yaml)

```yaml
name: qoder
description: Native 仓库代码专家，擅长 Objective-C 分析和重构
version: "1.0.0"

skills:
  - id: analyze-dependencies
    name: 分析依赖
    description: 分析文件依赖关系，生成依赖图
    tags: [analysis, objective-c, dependencies]
  - id: refactor-code
    name: 代码重构
    description: 重构 Objective-C 代码
    tags: [refactoring, objective-c]
  - id: generate-tests
    name: 生成测试
    description: 为 Objective-C 代码生成单元测试
    tags: [testing, objective-c]

workspace:
  cwd: /path/to/native-repo
  env:
    WORKSPACE: /path/to/native-repo

invocation:
  type: cli
  command: /usr/local/bin/qoder
  args:
    - --context
    - "{{input}}"
  timeout: 300000  # 5 minutes

transforms:
  input:
    template: |
      ## 任务
      {{task.description}}

      ## 上下文
      {{#each context.codeSnippets}}
      ### {{this.file}}
      ```{{this.language}}
      {{this.content}}
      ```
      {{/each}}

      ## 当前锁状态
      {{#each locks}}
      - {{file}}: 被 {{holder.agentId}} 锁定
      {{/each}}

      ## 🔒 文件锁协议（必须遵守）
      1. 修改文件前，先声明：`[DECLARE] 我要修改: file1.m, file2.h`
      2. 等待系统确认锁获取成功
      3. 完成后主动释放：`[RELEASE] file1.m`

  output:
    parse: markdown
    extract:
      - pattern: "\\[DECLARE\\] 我要修改: (.+)"
        action: request_lock
      - pattern: "\\[RELEASE\\] (.+)"
        action: release_lock
      - pattern: "```(\\w+)\\n([\\s\\S]*?)```"
        action: extract_code_blocks
```

### Adapter 运行时职责

1. **启动时**：加载配置，注册 A2A endpoint
2. **收到请求时**：
   - 从 Project Brain 获取上下文
   - 应用 input transform
   - 调用底层 Agent
   - 解析输出，处理锁声明
   - 应用 output transform
   - 返回 A2A 响应
3. **锁强制执行**：
   - 监控 Agent 输出中的 `[DECLARE]` 声明
   - 在实际修改前拦截，检查锁状态
   - 如果冲突，拒绝修改并返回错误

---

## 5. Orchestrator Skills 详细设计

### 5.1 TaskDecompositionSkill

```typescript
interface TaskDecompositionSkill {
  name: "task-decomposition";

  execute(input: {
    taskDescription: string;
    goal: string;
    constraints: string[];
    availableAgents: AgentRole[];
  }): Promise<{
    subtasks: TaskNode[];
    dependencies: Map<string, string[]>;
    assignments: Map<string, string[]>; // taskId -> agentIds
  }>;

  // 内部方法
  analyzeTask(description: string): TaskAnalysis;
  identifyRequiredSkills(description: string): string[];
  matchAgentsToSkills(skills: string[], agents: AgentRole[]): AgentMatch[];
  buildDependencyGraph(subtasks: TaskNode[]): DependencyGraph;
}

// 使用示例
const result = await skill.execute({
  taskDescription: "将 CardTableViewCell 迁移到 SwiftUI",
  goal: "完成 CardTableViewCell 的迁移，保持功能一致",
  constraints: ["不破坏现有测试", "保持 API 兼容"],
  availableAgents: brain.agents
});
```

### 5.2 AgentDispatchSkill

```typescript
interface AgentDispatchSkill {
  name: "agent-dispatch";

  execute(input: {
    agentId: string;
    task: TaskNode;
    context: DispatchContext;
  }): Promise<DispatchResult>;

  // 状态回调
  onProgress?: (update: ProgressUpdate) => void;
  onLockRequest?: (request: LockRequest) => Promise<LockResult>;
}

interface DispatchContext {
  projectGoal: string;
  agentRole: string;
  relevantCodeSnippets: CodeSnippet[];
  relatedOutputs: Artifact[];
  currentLocks: FileLock[];
  lockProtocolPrompt: string;
}

interface DispatchResult {
  status: "completed" | "blocked" | "failed" | "needs_clarification";
  output: {
    summary: string;
    files: ModifiedFile[];
    artifacts: Artifact[];
  };
  locksAcquired: string[];
  locksReleased: string[];
  questions?: string[];
}
```

### 5.3 ConflictDetectionSkill

```typescript
interface ConflictDetectionSkill {
  name: "conflict-detection";

  execute(input: {
    plannedChanges: FileChange[];
    activeLocks: FileLock[];
    recentCommits: Commit[];
  }): Promise<ConflictReport>;

  // 三层检测
  detectPathConflicts(changes: FileChange[], locks: FileLock[]): PathConflict[];
  detectRegionConflicts(changes: FileChange[], commits: Commit[]): RegionConflict[];
  detectSemanticConflicts(changes: FileChange[], context: SharedContext): Promise<SemanticConflict[]>;
}

interface ConflictReport {
  hasConflicts: boolean;
  pathConflicts: PathConflict[];      // 同文件修改
  regionConflicts: RegionConflict[];  // 同代码区域修改
  semanticConflicts: SemanticConflict[]; // 逻辑/语义冲突
  recommendations: string[];
}

interface FileChange {
  file: string;
  type: "create" | "modify" | "delete";
  regions?: CodeRegion[];
  description: string;
}
```

### 5.4 LockManagementSkill

```typescript
interface LockManagementSkill {
  name: "lock-management";

  // 获取锁
  acquireLock(request: {
    agentId: string;
    taskId: string;
    files: string[];
    granularity: "file" | "region";
    regions?: CodeRegion[];
    type: "exclusive" | "shared";
    expiresIn?: number; // milliseconds
  }): Promise<LockResult>;

  // 释放锁
  releaseLock(lockId: string): Promise<void>;
  releaseAllForAgent(agentId: string): Promise<void>;
  releaseAllForTask(taskId: string): Promise<void>;

  // 查询
  getLocks(filters?: { agentId?: string; file?: string }): FileLock[];
  getLockStatus(file: string): LockStatus;

  // 维护
  cleanupExpired(): Promise<void>;
}

interface LockResult {
  granted: boolean;
  lockId?: string;
  reason?: string; // 如果拒绝，说明原因
  waitingQueuePosition?: number;
}
```

### 5.5 TaskReviewSkill

```typescript
interface TaskReviewSkill {
  name: "task-review";

  execute(input: {
    task: TaskNode;
    output: TaskOutput;
    reviewType: "spec" | "quality" | "both";
  }): Promise<ReviewReport>;

  // 两阶段审查（参考 superpowers）
  reviewSpecCompliance(task: TaskNode, output: TaskOutput): SpecReviewResult;
  reviewCodeQuality(files: ModifiedFile[]): QualityReviewResult;
}

interface ReviewReport {
  passed: boolean;
  specReview: {
    compliant: boolean;
    missingRequirements: string[];
    extraWork: string[];
  };
  qualityReview: {
    approved: boolean;
    strengths: string[];
    issues: QualityIssue[];
  };
  requiresHumanReview: boolean;
}

interface QualityIssue {
  severity: "critical" | "important" | "minor";
  description: string;
  file: string;
  line?: number;
  suggestion?: string;
}
```

### 5.6 DecisionLogSkill

```typescript
interface DecisionLogSkill {
  name: "decision-log";

  recordDecision(input: {
    decision: string;
    decider: "human" | "orchestrator" | string; // agentId
    context: string;
    alternatives: string[];
    impact: string[];
  }): Promise<Decision>;

  queryDecisions(filters?: {
    decider?: string;
    since?: Date;
    relatedTo?: string; // file, task, agent
  }): Promise<Decision[]>;
}

interface Decision {
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
```

---

## 6. 冲突检测机制

### 三层检测

```
┌─────────────────────────────────────────────────────────────┐
│                     冲突检测层次                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: 文件路径层                                        │
│  ├── 检测：两个 Agent 是否要修改同一文件                    │
│  ├── 方法：路径字符串匹配                                   │
│  └── 解决：锁机制阻塞                                       │
│                                                             │
│  Layer 2: 代码区域层                                        │
│  ├── 检测：同一文件内的重叠修改区域                         │
│  ├── 方法：AST 分析，识别符号/函数/类边界                   │
│  └── 解决：区域锁或提示合并                                 │
│                                                             │
│  Layer 3: 语义逻辑层                                        │
│  ├── 检测：逻辑依赖、接口变更影响                           │
│  ├── 方法：AI 分析代码语义                                  │
│  └── 解决：提示人工确认                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 检测流程

```typescript
async function detectConflicts(
  plannedChanges: FileChange[],
  brain: ProjectBrain
): Promise<ConflictReport> {
  const report: ConflictReport = {
    hasConflicts: false,
    pathConflicts: [],
    regionConflicts: [],
    semanticConflicts: [],
    recommendations: []
  };

  // Layer 1: 文件路径检测
  for (const change of plannedChanges) {
    const lock = brain.locks.active.find(l => l.file === change.file);
    if (lock && lock.holder.agentId !== change.agentId) {
      report.pathConflicts.push({
        file: change.file,
        lockedBy: lock.holder,
        requestedBy: change.agentId
      });
    }
  }

  // Layer 2: 代码区域检测
  for (const change of plannedChanges) {
    if (change.regions) {
      const recentChanges = brain.context.recentFileChanges.get(change.file) || [];
      for (const recent of recentChanges) {
        if (regionsOverlap(change.regions, recent.regions)) {
          report.regionConflicts.push({
            file: change.file,
            region1: change.regions,
            region2: recent.regions,
            agent1: change.agentId,
            agent2: recent.agentId
          });
        }
      }
    }
  }

  // Layer 3: 语义检测（AI 分析）
  if (plannedChanges.length > 0) {
    const semanticResult = await analyzeSemanticConflicts(
      plannedChanges,
      brain.context
    );
    report.semanticConflicts = semanticResult.conflicts;
  }

  report.hasConflicts =
    report.pathConflicts.length > 0 ||
    report.regionConflicts.length > 0 ||
    report.semanticConflicts.length > 0;

  return report;
}
```

---

## 7. 锁机制设计

### 锁数据结构

```typescript
interface FileLock {
  id: string;
  file: string;
  granularity: "file" | "region";
  region?: {
    startLine: number;
    endLine: number;
    symbolName?: string;
  };
  holder: {
    agentId: string;
    taskId: string;
  };
  type: "exclusive" | "shared";
  status: "active" | "released" | "expired";
  acquiredAt: Date;
  expiresAt?: Date;
  waitingQueue: {
    agentId: string;
    taskId: string;
    requestedAt: Date;
  }[];
}
```

### 锁协议（Prompt 强制）

由于第三方 Agent 不可控，通过 **Prompt 协议** 实现锁机制：

```markdown
## 🔒 文件锁协议（必须遵守）

### 当前锁状态
{{#if locks}}
| 文件 | 锁持有者 | 状态 |
|------|---------|------|
{{#each locks}}
| {{file}} | {{holder}} | {{status}} |
{{/each}}
{{else}}
当前无活跃锁
{{/if}}

### 规则
1. **修改前声明**
   - 格式：`[DECLARE] 我要修改: file1.ts, file2.ts`
   - 等待系统确认后才能开始修改
   - 如果文件已被锁定，系统会告知你等待

2. **获取确认**
   - 成功：`[LOCK GRANTED] file1.ts`
   - 失败：`[LOCK DENIED] file1.ts - 被 AgentX 锁定`

3. **完成后释放**
   - 格式：`[RELEASE] file1.ts`
   - 必须在你完成修改后释放

4. **超时警告**
   - 锁默认 30 分钟后自动过期
   - 如需延长，使用 `[EXTEND] file1.ts`

### 当前任务上下文
- 你正在执行任务: {{task.title}}
- 任务目标: {{task.description}}
```

### 锁强制执行流程

```
┌──────────────────────────────────────────────────────────────┐
│                    Agent Adapter 运行时                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Agent 输出: "[DECLARE] 我要修改: CardViewModel.swift"       │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────────────────────────────────────┐                │
│  │ Adapter 拦截:                           │                │
│  │ 1. 解析声明                             │                │
│  │ 2. 调用 LockManagementSkill.acquireLock │                │
│  │ 3. 等待结果                             │                │
│  └─────────────────────────────────────────┘                │
│       │                                                      │
│       ├── 成功 ──► 注入 "[LOCK GRANTED] CardViewModel.swift" │
│       │                 允许 Agent 继续修改                   │
│       │                                                      │
│       └── 失败 ──► 注入 "[LOCK DENIED] - 被 Codex 锁定"      │
│                     阻止 Agent 修改该文件                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. Project Brain 数据模型

### 核心结构

```typescript
interface ProjectBrain {
  id: string;
  name: string;
  version: string;

  // 项目目标
  goal: {
    description: string;
    successCriteria: string[];
    constraints: string[];
  };

  // Agent 角色
  agents: AgentRole[];

  // 任务树
  tasks: TaskTree;

  // 共享上下文
  context: SharedContext;

  // 决策记录
  decisions: Decision[];

  // 锁状态
  locks: LockState;
}

interface AgentRole {
  id: string;
  name: string;
  description: string;
  skills: {
    id: string;
    name: string;
    tags: string[];
  }[];
  workingDirectory: string;
  endpoint?: string; // A2A endpoint
  status: "online" | "offline" | "busy" | "error";
  currentTask?: string;
}

interface SharedContext {
  // 项目背景
  background: string;

  // 代码片段（重要代码引用）
  codeSnippets: Map<string, {
    file: string;
    language: string;
    content: string;
    description: string;
  }>;

  // 其他 Agent 的产出
  outputs: Map<string, {
    taskId: string;
    agentId: string;
    summary: string;
    artifacts: string[];
  }>;

  // 待解决问题
  pendingQuestions: {
    id: string;
    question: string;
    askedBy: string;
    askedAt: Date;
    resolvedBy?: string;
    answer?: string;
  }[];

  // 最近文件修改记录（用于冲突检测）
  recentFileChanges: Map<string, {
    agentId: string;
    taskId: string;
    regions?: CodeRegion[];
    timestamp: Date;
  }[]>;
}

interface TaskTree {
  root: string; // root task id
  nodes: Map<string, TaskNode>;
}

interface TaskNode {
  id: string;
  parentId?: string;
  title: string;
  description: string;
  type: "milestone" | "task" | "subtask";

  // 分配
  assignee?: string; // agentId
  assignedAt?: Date;

  // 预期产出
  expectedOutput: {
    type: "code" | "document" | "analysis" | "decision";
    description: string;
    acceptanceCriteria: string[];
  };

  // 实际产出
  actualOutput?: {
    summary: string;
    artifacts: string[];
    files: string[];
    completedAt: Date;
  };

  // 状态
  status: TaskStatus;
  statusHistory: {
    status: TaskStatus;
    changedAt: Date;
    changedBy: string;
    reason?: string;
  }[];

  // 依赖
  dependencies: string[]; // task ids
  blockedBy?: string[];

  // 预计涉及的文件
  estimatedFiles: string[];

  // 子任务
  children: string[];
}

type TaskStatus =
  | "pending"      // 等待分配
  | "ready"        // 依赖完成，可分配
  | "assigned"     // 已分配给 Agent
  | "executing"    // Agent 执行中
  | "reviewing"    // 等待审查
  | "revision"     // 需要修改
  | "blocked"      // 被阻塞
  | "completed"    // 已完成
  | "failed";      // 执行失败

interface LockState {
  active: FileLock[];
  history: {
    lock: FileLock;
    releasedAt: Date;
    releasedBy: string;
  }[];
}
```

### 任务状态机

```
                    ┌─────────────┐
                    │   pending   │
                    └──────┬──────┘
                           │ 依赖完成
                           ▼
                    ┌─────────────┐
          ┌────────│    ready    │◄───────┐
          │        └──────┬──────┘        │
          │               │ 分配          │ 重新分配
          │               ▼               │
          │        ┌─────────────┐        │
          │        │   assigned  │────────┘
          │        └──────┬──────┘
          │               │ 开始执行
          │               ▼
          │        ┌─────────────┐
          │        │  executing  │◄───────┐
          │        └──────┬──────┘        │
          │               │ 执行完成      │ 需要更多信息
          │               ▼               │
          │        ┌─────────────┐        │
          │        │  reviewing  │────────┘
          │        └──────┬──────┘
          │               │
          │       ┌───────┴───────┐
          │       │               │
          │       ▼               ▼
          │ ┌──────────┐   ┌───────────┐
          │ │revision  │   │ completed │
          │ └────┬─────┘   └───────────┘
          │      │ 修改后重新提交
          │      └──────────────► reviewing
          │
          │ 阻塞
          ▼
   ┌─────────────┐
   │   blocked   │
   └─────────────┘
```

### Agent 调度时的上下文格式

当 Orchestrator 调度 Agent 执行任务时，会构建如下上下文：

```markdown
# 项目上下文

## 目标
{{brain.goal.description}}

## 你的角色
**{{agentRole.name}}**: {{agentRole.description}}
技能: {{#each agentRole.skills}}{{name}}, {{/each}}

## 当前任务
**{{task.title}}**
{{task.description}}

### 预期产出
- 类型: {{task.expectedOutput.type}}
- 描述: {{task.expectedOutput.description}}
- 验收标准:
{{#each task.expectedOutput.acceptanceCriteria}}
- {{this}}
{{/each}}

## 相关上下文
{{#each relevantOutputs}}
### {{agentId}} 的产出 (任务: {{taskId}})
{{summary}}
相关文件: {{artifacts}}
{{/each}}

### 相关代码
{{#each codeSnippets}}
#### {{file}}
```{{language}}
{{content}}
```
{{/each}}

## 其他 Agent 状态
{{#each otherAgents}}
- **{{name}}**: {{status}}{{#if currentTask}} (正在执行: {{currentTask}}){{/if}}
{{/each}}

## 🔒 文件锁协议
[见锁协议部分]
```

---

## 9. 安全模型

### Agent 身份认证

```typescript
interface AgentCredentials {
  agentId: string;
  apiKey: string;           // 注册时分配的唯一 API Key
  certificate?: string;     // 可选的客户端证书
  permissions: Permission[]; // 授权范围
  createdAt: Date;
  expiresAt?: Date;
}

interface Permission {
  resource: "repo" | "file" | "task" | "lock";
  action: "read" | "write" | "admin";
  scope: string; // repo path, file pattern, or "*" for all
}
```

### 认证流程

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent 注册流程                            │
├─────────────────────────────────────────────────────────────┤
│  1. 管理员运行: agent-orch agent add <name>                 │
│  2. 系统生成 API Key (格式: a2a_xxx... )                    │
│  3. API Key 存储在 .agent-orch/credentials/                 │
│  4. Agent Adapter 启动时加载 API Key                        │
│  5. 所有 A2A 请求携带 Authorization: Bearer <apiKey>        │
└─────────────────────────────────────────────────────────────┘
```

### API 安全

```yaml
# API 认证策略
public_endpoints:           # 无需认证
  - GET /api/status
  - GET /api/health

authenticated_endpoints:    # 需要 Agent API Key
  - GET /api/tasks/*
  - POST /api/tasks
  - GET /api/agents/*
  - POST /api/locks/*
  - DELETE /api/locks/*

admin_endpoints:            # 需要管理员 Token
  - POST /api/agents
  - DELETE /api/agents/*
  - DELETE /api/locks/*     # 手动释放锁
  - POST /api/decisions     # 添加人工决策
```

### Token 管理

```typescript
interface TokenConfig {
  accessTokenTTL: 3600;      // 1 小时
  refreshTokenTTL: 604800;   // 7 天
  rotationEnabled: true;     // 自动轮换
  maxConcurrentSessions: 3;
}
```

---

## 10. 错误处理与恢复

### Agent 失败恢复

```typescript
interface FailureRecovery {
  // 检测 Agent 失败
  detectFailure(agentId: string): Promise<FailureInfo>;

  // 回滚未完成的任务
  rollbackTask(taskId: string): Promise<RollbackResult>;

  // 释放失败的锁
  releaseFailedLocks(agentId: string): Promise<void>;

  // 任务重新分配策略
  reassignTask(taskId: string, strategy: "retry" | "reassign" | "manual"): Promise<void>;
}

interface FailureInfo {
  agentId: string;
  taskId?: string;
  type: "timeout" | "crash" | "error" | "disconnected";
  timestamp: Date;
  locksHeld: FileLock[];
  incompleteChanges: ModifiedFile[];
}
```

### 超时处理

```typescript
interface TimeoutConfig {
  // Agent 响应超时
  agentResponseTimeout: 300000;  // 5 分钟

  // 任务执行超时
  taskExecutionTimeout: 1800000; // 30 分钟

  // 锁持有超时
  lockHoldTimeout: 1800000;      // 30 分钟

  // 警告阈值（超时前的警告）
  warningThreshold: 0.8;         // 80% 时发出警告
}

// 超时处理流程
async function handleTimeout(agentId: string, taskId: string): Promise<void> {
  // 1. 发送警告给 Agent
  await sendWarning(agentId, "任务即将超时，请尽快完成或请求延期");

  // 2. 等待宽限期
  await waitForGracePeriod();

  // 3. 尝试优雅终止
  const graceful = await attemptGracefulTermination(agentId);
  if (!graceful) {
    // 4. 强制终止
    await forceTerminate(agentId);
  }

  // 5. 回滚和清理
  await rollbackIncompleteChanges(taskId);
  await releaseLocks(agentId);

  // 6. 更新任务状态
  await updateTaskStatus(taskId, "failed");
}
```

### 锁过期处理

```typescript
interface LockExpiryPolicy {
  // 默认过期时间
  defaultExpiry: 1800000; // 30 分钟

  // 过期前预警
  expiryWarning: 300000;  // 过期前 5 分钟预警

  // 过期行为
  onExpiry: "release" | "extend_once" | "alert_admin";
}

// 过期处理流程
async function handleLockExpiry(lock: FileLock): Promise<void> {
  // 检查 Agent 是否还在活跃
  const agentActive = await checkAgentStatus(lock.holder.agentId);

  if (agentActive) {
    // Agent 仍活跃，发送延期请求
    const extended = await requestExtension(lock.holder.agentId, lock.id);
    if (extended) return;
  }

  // 释放锁
  await releaseLock(lock.id);

  // 通知 Agent
  await notifyAgent(lock.holder.agentId, {
    type: "lock_expired",
    lockId: lock.id,
    file: lock.file
  });
}
```

### 持久化与恢复

```typescript
interface PersistenceStrategy {
  // 写入前日志 (Write-Ahead Log)
  writeAheadLog: {
    enabled: true;
    path: ".agent-orch/wal/";
    syncInterval: 1000; // 每秒同步
  };

  // 快照策略
  snapshot: {
    interval: 60000;    // 每分钟快照
    retention: 10;      // 保留最近 10 个快照
    path: ".agent-orch/snapshots/";
  };

  // 备份策略
  backup: {
    beforeMajorOp: true; // 重要操作前自动备份
    path: ".agent-orch/backups/";
    retention: 7;        // 保留 7 天
  };
}

// 恢复流程
async function recoverFromCrash(): Promise<void> {
  // 1. 检查 WAL 完整性
  const walValid = await validateWAL();

  // 2. 找到最新的一致性快照
  const lastSnapshot = await findLatestValidSnapshot();

  // 3. 重放 WAL 从快照点开始
  await replayWAL(lastSnapshot.timestamp);

  // 4. 恢复锁状态
  await recoverLockState();

  // 5. 标记未完成任务为 "interrupted"
  await markInterruptedTasks();
}
```

---

## 11. 锁强制验证层

由于锁机制依赖 Agent 遵守 Prompt 协议，添加验证层作为补充：

### 文件系统监控

```typescript
interface FileSystemMonitor {
  // 监控仓库目录
  watchPaths: string[];

  // 变更事件
  onFileChange(event: {
    file: string;
    changeType: "modify" | "create" | "delete";
    timestamp: Date;
  }): Promise<void>;
}

// 变更验证
async function validateFileChange(
  file: string,
  agentId: string
): Promise<ValidationResult> {
  // 检查是否有活跃锁
  const activeLock = findActiveLock(file);

  if (!activeLock) {
    // 无锁，可能是违规修改
    return {
      valid: false,
      reason: "file_not_locked",
      message: `文件 ${file} 被修改但未持有锁`
    };
  }

  if (activeLock.holder.agentId !== agentId) {
    // 锁持有者与修改者不匹配
    return {
      valid: false,
      reason: "lock_mismatch",
      message: `文件 ${file} 被 ${activeLock.holder.agentId} 锁定，但 ${agentId} 修改了它`
    };
  }

  return { valid: true };
}
```

### 违规检测与告警

```typescript
interface ViolationHandler {
  // 记录违规
  logViolation(violation: {
    agentId: string;
    file: string;
    type: "undeclared_modify" | "lock_mismatch" | "expired_lock_modify";
    timestamp: Date;
    details: string;
  }): Promise<void>;

  // 违规阈值
  violationThreshold: 3; // 超过 3 次违规后采取措施

  // 违规处理
  onViolation(violation: Violation): Promise<void>;
}

// 违规处理流程
async function handleViolation(violation: Violation): Promise<void> {
  // 1. 记录违规
  await logViolation(violation);

  // 2. 发送告警给管理员
  await sendAlert({
    level: "warning",
    message: `Agent ${violation.agentId} 违反锁协议: ${violation.type}`,
    file: violation.file
  });

  // 3. 检查违规计数
  const count = await getViolationCount(violation.agentId);
  if (count >= violationThreshold) {
    // 4. 禁用 Agent
    await disableAgent(violation.agentId, "多次违反锁协议");
  }
}
```

### 事后冲突检测

```typescript
// 任务完成后的冲突检测
async function postCompletionCheck(taskId: string): Promise<ConflictReport> {
  const task = await getTask(taskId);

  // 获取任务修改的文件
  const modifiedFiles = task.actualOutput.files;

  // 对每个文件执行 diff 分析
  for (const file of modifiedFiles) {
    // 获取文件的其他修改
    const concurrentChanges = await getConcurrentChanges(file, task);

    if (concurrentChanges.length > 0) {
      // 检测是否有实际冲突
      const conflicts = await detectConflicts(file, task, concurrentChanges);
      if (conflicts.length > 0) {
        // 通知管理员
        await alertConflicts(taskId, conflicts);
      }
    }
  }
}
```

---

## 12. CLI 界面设计

### 命令结构

```bash
agent-orch <command> [options]

# 项目初始化
agent-orch init                    # 初始化项目，创建 .agent-orch/ 目录
agent-orch init --from-existing    # 从现有项目导入配置

# Agent 管理
agent-orch agent list              # 列出所有已注册的 Agent
agent-orch agent add <name>        # 添加新 Agent（交互式配置）
agent-orch agent add <name> --config ./agent.yaml  # 从配置文件添加
agent-orch agent remove <name>     # 移除 Agent
agent-orch agent status <name>     # 查看 Agent 状态
agent-orch agent test <name>       # 测试 Agent 连接

# 任务管理
agent-orch task create             # 创建任务（交互式）
agent-orch task create --file task.yaml  # 从文件创建
agent-orch task list               # 列出所有任务
agent-orch task show <id>          # 查看任务详情
agent-orch task assign <id> <agent>  # 手动分配任务
agent-orch task approve <id>       # 批准任务结果
agent-orch task reject <id> --reason "..."  # 驳回任务

# 运行控制
agent-orch start                   # 启动编排层和所有 Agent
agent-orch start --agents qoder,codex  # 只启动指定 Agent
agent-orch stop                    # 停止所有
agent-orch restart                 # 重启

# 状态查看
agent-orch status                  # 项目整体状态
agent-orch status --json           # JSON 输出（供 Web Dashboard 使用）
agent-orch logs [agent]            # 查看日志
agent-orch logs --follow           # 实时跟踪日志

# 锁管理
agent-orch lock list               # 列出当前所有锁
agent-orch lock release <id>       # 手动释放锁（管理员操作）
agent-orch lock clear              # 清除所有过期锁

# Web 界面
agent-orch web                     # 启动 Web Dashboard
agent-orch web --port 3000         # 指定端口
```

### CLI 交互示例

```bash
$ agent-orch init
? 项目名称: Native Card Migration
? 项目描述: 将 Native 卡片迁移到新技术栈
? 目标仓库 (多个用逗号分隔): /path/to/native-repo, /path/to/new-repo
✓ 创建 .agent-orch/config.yaml
✓ 创建 .agent-orch/brain.json
✓ 创建 .agent-orch/agents/ 目录

$ agent-orch agent add qoder
? Agent 类型: CLI 工具
? 命令路径: /usr/local/bin/qoder
? 工作目录: /path/to/native-repo
? 描述: Native 仓库代码专家
? 技能标签 (逗号分隔): objective-c, ios, native, refactoring
✓ Agent "qoder" 已注册

$ agent-orch task create
? 任务标题: 分析 CardTableViewCell 的依赖关系
? 任务描述: [输入详细描述，支持 Markdown]
? 预期产出: 文档 + 依赖图
? 优先级: 高
? 指派给: [留空自动分配]
✓ 任务 #T001 已创建
```

### TUI (终端用户界面)

```
┌─────────────────────────────────────────────────────────────────┐
│  Agent Orchestrator - Native Card Migration                     │
├─────────────────────────────────────────────────────────────────┤
│  状态: ● 运行中    任务: 12/20 完成    Agent: 3/4 在线          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── 活跃任务 ──────────────────────────────────────────────┐   │
│  │ #T015 [执行中] Codex: 实现 CardViewModel 单元测试        │   │
│  │ #T016 [审查中] Qoder: 分析 CardTableViewCell 依赖       │   │
│  │ #T017 [待分配] 编写迁移文档                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌── 文件锁 ────────────────────────────────────────────────┐   │
│  │ 📄 CardViewModel.swift [Codex] 截止: 14:30              │   │
│  │ 📄 CardTableViewCell.m [Qoder] 截止: 15:00              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [a] 添加任务  [s] 状态详情  [l] 日志  [w] Web界面  [q] 退出   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. Web Dashboard 设计

### 界面布局

```
┌────────────────────────────────────────────────────────────────────────────┐
│  🤖 Agent Orchestrator                        Native Card Migration        │
│                                               ● 运行中 · 3/4 Agent 在线     │
├──────────────┬─────────────────────────────────────────────────────────────┤
│              │                                                             │
│  📊 概览     │   ┌── 任务看板 ──────────────────────────────────────────┐   │
│  📋 任务     │   │                                                         │   │
│  🤖 Agent   │   │  待处理          执行中           审查中          完成  │   │
│  🔒 文件锁   │   │  ┌────────┐     ┌────────┐      ┌────────┐     ┌────┐│   │
│  📝 决策记录 │   │  │ #T017  │     │ #T015  │      │ #T016  │     │ 12 ││   │
│  📜 日志     │   │  │ 文档   │     │ 单测   │      │ 分析   │     │    ││   │
│              │   │  │        │     │ Codex  │      │ Qoder  │     │    ││   │
│              │   │  └────────┘     └────────┘      └────────┘     └────┘│   │
│              │   │                                                         │   │
│              │   └─────────────────────────────────────────────────────────┘   │
│              │                                                             │
│              │   ┌── Agent 状态 ─────────────────────────────────────────┐   │
│              │   │                                                         │   │
│              │   │  ● Qoder    空闲    最后任务: #T016    仓库: native   │   │
│              │   │  ● Codex    忙碌    当前任务: #T015    仓库: new      │   │
│              │   │  ● iFlow    空闲    最后任务: #T012    仓库: both     │   │
│              │   │  ○ Claude   离线    -                   -            │   │
│              │   │                                                         │   │
│              │   └─────────────────────────────────────────────────────────┘   │
│              │                                                             │
│              │   [创建任务]  [批准/驳回]  [查看日志]                        │
└──────────────┴─────────────────────────────────────────────────────────────┘
```

### 核心页面

#### 1. 项目概览页
- 项目目标和成功指标
- 整体进度条（基于任务完成率）
- 关键里程碑时间线
- 最近决策摘要
- 活跃告警（阻塞、冲突）

#### 2. 任务看板页
- Kanban 风格任务板（可拖拽）
- 任务卡片显示：ID、标题、负责 Agent、状态、优先级
- 点击任务卡片展开详情侧边栏
- 支持筛选（按 Agent、按仓库、按状态）
- 任务依赖关系可视化图

#### 3. Agent 管理页
- Agent 列表及状态
- 每个 Agent 的技能标签
- 历史/当前任务
- 资源使用（如果可获取）
- "测试连接" 按钮

#### 4. 文件锁可视化
- 树形文件浏览器
- 颜色标记锁状态：
  - 🟢 无锁
  - 🔴 独占锁（显示持有者 Agent）
  - 🟡 共享锁
- 锁详情悬停卡片
- 手动释放锁（需管理员权限）

#### 5. 决策记录页
- 按时间线展示所有决策
- 每条决策：决策内容、决策者、理由、影响范围
- 可添加人工决策
- 决策搜索

#### 6. 日志查看器
- 实时日志流（WebSocket）
- 按 Agent / 任务 / 时间筛选
- 日志级别过滤（ERROR / WARN / INFO / DEBUG）
- 全文搜索
- 日志导出

### API 设计（供 Web Dashboard 使用）

```yaml
# REST API 端点
GET  /api/project                    # 项目信息
GET  /api/status                     # 整体状态
GET  /api/tasks                      # 任务列表
GET  /api/tasks/:id                  # 任务详情
POST /api/tasks                      # 创建任务
PUT  /api/tasks/:id/approve          # 批准任务
PUT  /api/tasks/:id/reject           # 驳回任务
GET  /api/agents                     # Agent 列表
GET  /api/agents/:name               # Agent 详情
POST /api/agents                     # 注册 Agent
DELETE /api/agents/:name             # 移除 Agent
GET  /api/locks                      # 锁列表
DELETE /api/locks/:id                # 释放锁
GET  /api/decisions                  # 决策列表
POST /api/decisions                  # 添加决策
GET  /api/logs/stream                # WebSocket 日志流

# 认证
Authorization: Bearer <token>  # 管理员操作需要认证
```

---

## 14. 完整架构图

```
                                    ┌─────────────────────────────────┐
                                    │         Human User              │
                                    │  (Task Publisher / Approver)    │
                                    └───────────────┬─────────────────┘
                                                    │
                              ┌─────────────────────┼─────────────────────┐
                              │                     │                     │
                              ▼                     ▼                     ▼
                       ┌──────────┐          ┌──────────┐         ┌──────────┐
                       │   CLI    │          │   Web    │         │  IDE     │
                       │Interface │          │Dashboard │         │ Plugin   │
                       └────┬─────┘          └────┬─────┘         └────┬─────┘
                            │                     │                    │
                            └─────────────────────┼────────────────────┘
                                                  │
                                                  ▼
                              ┌───────────────────────────────────────┐
                              │         Orchestrator Agent            │
                              │            (Mastra)                   │
                              │  ┌─────────────────────────────────┐  │
                              │  │       Orchestrator Skills       │  │
                              │  │  - TaskDecompositionSkill       │  │
                              │  │  - AgentDispatchSkill           │  │
                              │  │  - ConflictDetectionSkill       │  │
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
                    │  Project Brain  │  │  Lock Manager   │  │  A2A Registry   │
                    │  (Shared State) │  │  (Lock Service) │  │  (Connections)  │
                    └─────────────────┘  └─────────────────┘  └────────┬────────┘
                                                                          │
                        ┌─────────────────────────────────────────────────┤
                        │                                                 │
            ┌───────────┴───────────┐                       ┌─────────────┴───────────┐
            │                       │                       │                         │
            ▼                       ▼                       ▼                         ▼
    ┌───────────────┐       ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
    │ Agent Adapter │       │ Agent Adapter │       │ Agent Adapter │       │  Native A2A   │
    │   (Qoder)     │       │   (Codex)     │       │   (iFlow)     │       │    Agent      │
    │  CLI Wrapper  │       │  CLI Wrapper  │       │  API Wrapper  │       │  (Custom)     │
    └───────┬───────┘       └───────┬───────┘       └───────┬───────┘       └───────┬───────┘
            │                       │                       │                       │
            ▼                       ▼                       ▼                       ▼
    ┌───────────────┐       ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
    │     Qoder     │       │     Codex     │       │     iFlow     │       │   Claude      │
    │   (Native)    │       │   (New)       │       │   (CI/CD)     │       │   (Review)    │
    │     Repo      │       │     Repo      │       │               │       │               │
    └───────────────┘       └───────────────┘       └───────────────┘       └───────────────┘
```

---

## 15. 目录结构

```
agent-orchestrator/
├── packages/
│   ├── core/                          # 核心库
│   │   ├── src/
│   │   │   ├── brain/                 # Project Brain 实现
│   │   │   │   ├── brain.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── persistence.ts
│   │   │   ├── lock/                  # 锁机制
│   │   │   │   ├── manager.ts
│   │   │   │   ├── protocol.ts
│   │   │   │   └── types.ts
│   │   │   ├── conflict/              # 冲突检测
│   │   │   │   ├── detector.ts
│   │   │   │   ├── path-detector.ts
│   │   │   │   ├── region-detector.ts
│   │   │   │   └── semantic-detector.ts
│   │   │   └── utils/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── orchestrator/                  # Orchestrator Agent (Mastra)
│   │   ├── src/
│   │   │   ├── agent.ts               # Orchestrator Agent 定义
│   │   │   ├── skills/                # 6 个核心 Skill
│   │   │   │   ├── task-decomposition.ts
│   │   │   │   ├── agent-dispatch.ts
│   │   │   │   ├── conflict-detection.ts
│   │   │   │   ├── lock-management.ts
│   │   │   │   ├── task-review.ts
│   │   │   │   └── decision-log.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── adapter/                       # Agent Adapter 框架
│   │   ├── src/
│   │   │   ├── adapter.ts             # Adapter 基类
│   │   │   ├── cli-adapter.ts         # CLI 类型 Agent 适配
│   │   │   ├── api-adapter.ts         # API 类型 Agent 适配
│   │   │   ├── transformer.ts         # Input/Output 转换
│   │   │   ├── lock-interceptor.ts    # 锁声明拦截
│   │   │   └── a2a-server.ts          # A2A endpoint 暴露
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/                           # CLI 工具
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── init.ts
│   │   │   │   ├── agent.ts
│   │   │   │   ├── task.ts
│   │   │   │   ├── start.ts
│   │   │   │   ├── status.ts
│   │   │   │   ├── lock.ts
│   │   │   │   └── web.ts
│   │   │   ├── tui/                   # TUI 界面
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                           # Web Dashboard
│       ├── src/
│       │   ├── pages/
│       │   │   ├── overview.tsx
│       │   │   ├── tasks.tsx
│       │   │   ├── agents.tsx
│       │   │   ├── locks.tsx
│       │   │   ├── decisions.tsx
│       │   │   └── logs.tsx
│       │   ├── components/
│       │   ├── api/                   # API 客户端
│       │   └── App.tsx
│       ├── package.json
│       └── tsconfig.json
│
├── examples/
│   └── native-card-migration/         # 示例项目
│       ├── .agent-orch/
│       │   ├── config.yaml
│       │   ├── brain.json
│       │   └── agents/
│       │       ├── qoder.yaml
│       │       ├── codex.yaml
│       │       └── iflow.yaml
│       └── README.md
│
├── docs/                              # 文档
│   ├── getting-started.md
│   ├── architecture.md
│   ├── agent-adapter.md
│   ├── skills.md
│   └── api-reference.md
│
├── package.json
├── tsconfig.json
├── turbo.json                         # Turborepo 配置
└── README.md
```

---

## 16. 实现优先级

### Phase 1: MVP (最小可用版本)
1. Project Brain 核心数据结构和持久化
2. Lock Manager 基础实现
3. CLI 基础命令 (init, agent add, task create, start)
4. Agent Adapter CLI Wrapper
5. Orchestrator Agent 骨架 + TaskDecompositionSkill

### Phase 2: 协作核心
1. AgentDispatchSkill
2. LockManagementSkill
3. 冲突检测 (Layer 1 + Layer 2)
4. 锁协议 Prompt 模板
5. 任务状态机

### Phase 3: 审查与决策
1. TaskReviewSkill
2. DecisionLogSkill
3. 两阶段审查流程
4. Web Dashboard 基础版

### Phase 4: 完善
1. 冲突检测 Layer 3 (语义分析)
2. TUI 界面
3. Web Dashboard 完整版
4. 日志系统
5. 文档和示例