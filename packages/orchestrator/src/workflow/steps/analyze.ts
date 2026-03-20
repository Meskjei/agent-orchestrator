import { createStep } from '@mastra/core/workflows';
import { Agent } from '@mastra/core/agent';
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
  cwd: z.string(),
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

      return { subtasks: response.object.subtasks, cwd: inputData.cwd };
    },
  });
}