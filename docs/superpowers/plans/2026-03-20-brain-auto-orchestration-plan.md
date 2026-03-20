# Brain 自动编排 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Brain 自动分解任务、并发派发、审查结果，通过 Mastra Workflow 实现

**Architecture:** 三层 Workflow（analyze → dispatch → review），Agent 做决策，Workflow 控流程

**Tech Stack:** @mastra/core (createWorkflow, createStep), zod, @agent-orchestrator/acp

**Spec:** `docs/superpowers/specs/2026-03-20-brain-auto-orchestration-design.md`

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `packages/orchestrator/src/workflow/types.ts` | Subtask, ReviewReport Zod schemas |
| `packages/orchestrator/src/workflow/steps/analyze.ts` | Step 1: Brain Agent 分析任务 |
| `packages/orchestrator/src/workflow/steps/dispatch.ts` | Step 2: ACP Gateway 并发派发 |
| `packages/orchestrator/src/workflow/steps/review.ts` | Step 3: Brain Agent 审查结果 |
| `packages/orchestrator/src/workflow/orchestrator-workflow.ts` | Workflow 定义 |
| `packages/orchestrator/src/index.ts` | 更新导出 |

---

## Task 1: 类型定义

**Files:**
- Create: `packages/orchestrator/src/workflow/types.ts`

- [ ] **Step 1: 定义 Zod schemas**

```typescript
// packages/orchestrator/src/workflow/types.ts
import { z } from 'zod';
import { DispatchResult } from '@agent-orchestrator/acp';

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

- [ ] **Step 2: Commit**

```bash
git add packages/orchestrator/src/workflow/types.ts
git commit -m "feat(orchestrator): add workflow type definitions"
```

---

## Task 2: Analyze Step

**Files:**
- Create: `packages/orchestrator/src/workflow/steps/analyze.ts`

- [ ] **Step 1: 实现 analyze step**

```typescript
// packages/orchestrator/src/workflow/steps/analyze.ts
import { createStep } from '@mastra/core/workflows';
import { Agent } from '@mastra/core/agent';
import { AgentDescriptor } from '@agent-orchestrator/acp';
import { z } from 'zod';
import { SubtaskListSchema } from '../types.js';

const inputSchema = z.object({
  task: z.string(),
  cwd: z.string(),
  availableAgents: z.array(z.object({
    id: z.string(),
    name: z.string(),
    capabilities: z.array(z.string()),
  })),
});

const outputSchema = z.object({
  subtasks: z.array(z.object({
    id: z.number(),
    task: z.string(),
    agent: z.string(),
    files: z.array(z.string()).optional(),
    dependsOn: z.array(z.number()).optional(),
  })),
});

export function createAnalyzeStep(brainAgent: Agent) {
  return createStep({
    id: 'analyze',
    description: '分析任务并分解为子任务',
    inputSchema,
    outputSchema,
    execute: async ({ inputData }) => {
      const agentList = inputData.availableAgents
        .map(a => `- ${a.id}: ${a.name} (能力: ${a.capabilities.join(', ')})`)
        .join('\n');

      const response = await brainAgent.generate(
        `请将以下任务分解为可执行的子任务。

任务: ${inputData.task}
工作目录: ${inputData.cwd}

可用的 Worker Agent:
${agentList}

要求:
1. 每个子任务要具体、可执行
2. 选择最合适的 Agent
3. 标记涉及的文件
4. 无依赖的子任务可以并发执行
5. 用结构化 JSON 格式返回`,
        {
          structuredOutput: { schema: SubtaskListSchema },
        }
      );

      return { subtasks: response.object.subtasks };
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/orchestrator/src/workflow/steps/analyze.ts
git commit -m "feat(orchestrator): implement analyze workflow step"
```

---

## Task 3: Dispatch Step

**Files:**
- Create: `packages/orchestrator/src/workflow/steps/dispatch.ts`

- [ ] **Step 1: 实现 dispatch step**

```typescript
// packages/orchestrator/src/workflow/steps/dispatch.ts
import { createStep } from '@mastra/core/workflows';
import { ACPGateway, DispatchResult } from '@agent-orchestrator/acp';
import { z } from 'zod';
import { SubtaskSchema } from '../types.js';

const inputSchema = z.object({
  subtasks: z.array(SubtaskSchema),
  cwd: z.string(),
});

const outputSchema = z.object({
  results: z.array(z.object({
    workerId: z.string(),
    output: z.string(),
    error: z.string().optional(),
  })),
  failed: z.array(z.number()),
});

export function createDispatchStep(gateway: ACPGateway) {
  return createStep({
    id: 'dispatch',
    description: '并发派发子任务给 Worker',
    inputSchema,
    outputSchema,
    execute: async ({ inputData }) => {
      const subtasks = inputData.subtasks;

      // 按依赖分批
      const noDeps = subtasks.filter(st => !st.dependsOn?.length);
      const withDeps = subtasks.filter(st => st.dependsOn?.length);

      const results: DispatchResult[] = [];
      const failed: number[] = [];

      // 第一批: 无依赖的子任务并发执行
      if (noDeps.length > 0) {
        const batchResults = await Promise.all(
          noDeps.map(st =>
            gateway.dispatch({
              agentId: st.agent,
              prompt: st.task,
              cwd: inputData.cwd,
              files: st.files,
            })
          )
        );

        for (let i = 0; i < batchResults.length; i++) {
          results.push(batchResults[i]);
          if (batchResults[i].error) {
            failed.push(noDeps[i].id);
          }
        }
      }

      // 第二批: 有依赖的子任务 (等第一批完成)
      for (const st of withDeps) {
        const depFailed = st.dependsOn!.some(depId => failed.includes(depId));
        if (depFailed) {
          failed.push(st.id);
          results.push({
            workerId: '',
            output: '',
            toolCalls: [],
            locksAcquired: [],
            locksReleased: [],
            error: `Skipped: dependency failed`,
          });
          continue;
        }

        const result = await gateway.dispatch({
          agentId: st.agent,
          prompt: st.task,
          cwd: inputData.cwd,
          files: st.files,
        });

        results.push(result);
        if (result.error) {
          failed.push(st.id);
        }
      }

      return { results, failed };
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/orchestrator/src/workflow/steps/dispatch.ts
git commit -m "feat(orchestrator): implement dispatch workflow step"
```

---

## Task 4: Review Step

**Files:**
- Create: `packages/orchestrator/src/workflow/steps/review.ts`

- [ ] **Step 1: 实现 review step**

```typescript
// packages/orchestrator/src/workflow/steps/review.ts
import { createStep } from '@mastra/core/workflows';
import { Agent } from '@mastra/core/agent';
import { DispatchResult } from '@agent-orchestrator/acp';
import { z } from 'zod';
import { ReviewReportSchema } from '../types.js';

const inputSchema = z.object({
  task: z.string(),
  subtasks: z.array(z.object({
    id: z.number(),
    task: z.string(),
  })),
  results: z.array(z.object({
    workerId: z.string(),
    output: z.string(),
    error: z.string().optional(),
  })),
  failed: z.array(z.number()),
});

const outputSchema = ReviewReportSchema;

export function createReviewStep(brainAgent: Agent) {
  return createStep({
    id: 'review',
    description: '审查任务执行结果',
    inputSchema,
    outputSchema,
    execute: async ({ inputData }) => {
      const resultsSummary = inputData.subtasks.map(st => {
        const result = inputData.results[inputData.subtasks.indexOf(st)];
        return `- 子任务${st.id} "${st.task}": ${result?.error ? '❌ ' + result.error : '✅ 成功'}`;
      }).join('\n');

      const response = await brainAgent.generate(
        `请审查以下任务的执行结果。

原始任务: ${inputData.task}

执行结果:
${resultsSummary}

请判断:
1. 所有子任务是否成功完成
2. 输出质量是否满足要求
3. 是否需要重试失败的子任务

用结构化 JSON 格式返回审查报告。`,
        {
          structuredOutput: { schema: ReviewReportSchema },
        }
      );

      return response.object;
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/orchestrator/src/workflow/steps/review.ts
git commit -m "feat(orchestrator): implement review workflow step"
```

---

## Task 5: Orchestrator Workflow

**Files:**
- Create: `packages/orchestrator/src/workflow/orchestrator-workflow.ts`

- [ ] **Step 1: 实现 workflow**

```typescript
// packages/orchestrator/src/workflow/orchestrator-workflow.ts
import { createWorkflow } from '@mastra/core/workflows';
import { Agent } from '@mastra/core/agent';
import { ACPGateway } from '@agent-orchestrator/acp';
import { z } from 'zod';
import { createAnalyzeStep } from './steps/analyze.js';
import { createDispatchStep } from './steps/dispatch.js';
import { createReviewStep } from './steps/review.js';

export function createOrchestratorWorkflow(brainAgent: Agent, gateway: ACPGateway) {
  const analyzeStep = createAnalyzeStep(brainAgent);
  const dispatchStep = createDispatchStep(gateway);
  const reviewStep = createReviewStep(brainAgent);

  const workflow = createWorkflow({
    id: 'orchestrator-workflow',
    description: '任务编排工作流: 分析→派发→审查',
    inputSchema: z.object({
      task: z.string(),
      cwd: z.string(),
    }),
    outputSchema: z.object({
      passed: z.boolean(),
      reason: z.string(),
    }),
  })
    .map(async ({ inputData }) => {
      const agents = gateway.listAgents();
      return {
        task: inputData.task,
        cwd: inputData.cwd,
        availableAgents: agents.map(a => ({
          id: a.id,
          name: a.name,
          capabilities: a.capabilities,
        })),
      };
    })
    .then(analyzeStep)
    .map(async ({ inputData }) => ({
      subtasks: inputData.subtasks,
      cwd: '', // 需要从前面传递
    }))
    .then(dispatchStep)
    .then(reviewStep);

  workflow.commit();

  return workflow;
}
```

- [ ] **Step 2: 更新 brain.ts 导出 workflow**

```typescript
// 在 brain.ts 中添加:
import { createOrchestratorWorkflow } from './workflow/orchestrator-workflow.js';

export function createBrain(config: BrainConfig) {
  // ... 现有代码 ...
  const workflow = createOrchestratorWorkflow(agent, gateway);
  return { agent, gateway, workflow };
}
```

- [ ] **Step 3: 更新 index.ts**

```typescript
// 添加:
export { createOrchestratorWorkflow } from './workflow/orchestrator-workflow.js';
```

- [ ] **Step 4: Commit**

```bash
git add packages/orchestrator/src/workflow/orchestrator-workflow.ts packages/orchestrator/src/brain.ts packages/orchestrator/src/index.ts
git commit -m "feat(orchestrator): implement orchestrator workflow"
```

---

## Task 6: 测试

- [ ] **Step 1: 单元测试**

测试 analyze/dispatch/review 各 step 的逻辑。

- [ ] **Step 2: 运行测试**

```bash
cd packages/orchestrator && npm test
```

- [ ] **Step 3: E2E 测试**

用真实任务测试完整 workflow。

- [ ] **Step 4: Commit**

```bash
git commit -m "test(orchestrator): add workflow tests"
```
