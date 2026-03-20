# Brain 自动编排优化设计

**日期：** 2026-03-20
**状态：** 待审批

## 问题

当前 Brain 每次 `agent.generate()` 是独立调用，无法：
1. 自动分解复杂任务为子任务
2. 并发执行无依赖的子任务
3. 审查执行结果

## 方案

**Mastra Workflow + Agent 混合架构**

Workflow 控制流程（确定性），Agent 做决策（智能性）。

## 架构

```
用户: "开发一个备忘录前端应用"
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  OrchestratorWorkflow (Mastra Workflow)              │
│                                                     │
│  ┌─────────────┐   ┌─────────────┐   ┌───────────┐ │
│  │  analyze    │ → │  dispatch   │ → │  review   │ │
│  │  (Agent)    │   │  (并发)     │   │  (Agent)  │ │
│  └─────────────┘   └─────────────┘   └───────────┘ │
│                                                     │
│  输入: task, cwd                                    │
│  输出: ReviewReport                                 │
└─────────────────────────────────────────────────────┘
```

## 数据流

### Step 1: analyze (Brain Agent)

**输入：**
```typescript
{ task: string, cwd: string, availableAgents: AgentDescriptor[] }
```

**Agent Prompt：**
```
分析以下任务，分解为可执行的子任务。
可用的 Worker Agent: [opencode, claude]
请返回子任务列表，每个子任务包含：id, task, agent, files, dependsOn
```

**输出（结构化）：**
```typescript
interface Subtask {
  id: number;
  task: string;           // 子任务描述
  agent: string;          // 选择的 Agent ID
  files?: string[];       // 涉及的文件
  dependsOn?: number[];   // 依赖的子任务 ID
}

{ subtasks: Subtask[] }
```

### Step 2: dispatch (ACP Gateway)

**输入：** `{ subtasks: Subtask[], cwd: string }`

**逻辑：**
1. 按依赖关系分批：无依赖的先执行，有依赖的等依赖完成
2. 同一批内并发执行：`Promise.all(batch.map(...))`
3. 收集所有结果

**输出：**
```typescript
interface DispatchBatch {
  results: DispatchResult[];   // 每个子任务的执行结果
  failed: number[];            // 失败的子任务 ID
}
```

### Step 3: review (Brain Agent)

**输入：** 原始任务 + 子任务结果

**Agent Prompt：**
```
审查以下任务的执行结果。
原始任务: "开发备忘录前端应用"
执行结果:
- 子任务1: 创建 index.html → 成功
- 子任务2: 创建 style.css → 成功

请评估是否通过审查。
```

**输出（结构化）：**
```typescript
interface ReviewReport {
  passed: boolean;
  reason: string;
  retrySubtasks?: number[];  // 需要重试的子任务 ID
}
```

**重试逻辑：**
- 如果 `passed: false` 且有 `retrySubtasks` → 重新 dispatch 这些子任务
- 最多重试 3 次

## 文件结构

```
packages/orchestrator/src/
├── brain.ts                    # 保留，Agent 定义
├── workflow/
│   ├── types.ts                # Subtask, ReviewReport 类型
│   ├── orchestrator-workflow.ts # Workflow 定义
│   └── steps/
│       ├── analyze.ts          # Step 1: 任务分析
│       ├── dispatch.ts         # Step 2: 并发派发
│       └── review.ts           # Step 3: 结果审查
```

## 接口定义

```typescript
// workflow/types.ts

import { z } from 'zod';

export const SubtaskSchema = z.object({
  id: z.number(),
  task: z.string(),
  agent: z.string(),
  files: z.array(z.string()).optional(),
  dependsOn: z.array(z.number()).optional(),
});

export const SubtaskListSchema = z.object({
  subtasks: z.array(SubtaskSchema),
});

export const ReviewReportSchema = z.object({
  passed: z.boolean(),
  reason: z.string(),
  retrySubtasks: z.array(z.number()).optional(),
});

export type Subtask = z.infer<typeof SubtaskSchema>;
export type ReviewReport = z.infer<typeof ReviewReportSchema>;

export interface WorkflowInput {
  task: string;
  cwd: string;
}

export interface WorkflowOutput {
  passed: boolean;
  reason: string;
  subtasks: Subtask[];
  results: DispatchResult[];
}
```

## 依赖

- `@mastra/core/workflows` (createWorkflow, createStep)
- `zod` (结构化输出 schema)
- `@agent-orchestrator/acp` (ACPGateway)

## 测试

- 单元测试：mock Agent + Gateway，测试 workflow 流程
- 集成测试：真实 Agent + mock Gateway
- E2E 测试：真实 Agent + 真实 opencode
