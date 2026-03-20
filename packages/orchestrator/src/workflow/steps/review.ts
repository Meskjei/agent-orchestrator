import { createStep } from '@mastra/core/workflows';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { ReviewReportSchema } from '../types.js';

const inputSchema = z.object({
  results: z.array(z.object({
    workerId: z.string(),
    output: z.string(),
    error: z.string().optional(),
  })),
  failed: z.array(z.number()),
  subtasks: z.array(z.object({
    id: z.number(),
    task: z.string(),
  })),
  cwd: z.string(),
});

const outputSchema = ReviewReportSchema;

export function createReviewStep(brainAgent: Agent) {
  return createStep({
    id: 'review',
    description: '审查任务执行结果',
    inputSchema,
    outputSchema,
    execute: async ({ inputData }) => {
      const resultsSummary = inputData.subtasks.map((st, i) => {
        const r = inputData.results[i];
        return `- 子任务${st.id} "${st.task}": ${r?.error ? '❌ ' + r.error : '✅ 成功'}`;
      }).join('\n');

      const response = await brainAgent.generate(
        `请审查以下任务的执行结果。

子任务执行结果:
${resultsSummary}

失败的子任务 ID: ${inputData.failed.length > 0 ? inputData.failed.join(', ') : '无'}

请判断:
1. 所有子任务是否成功完成
2. 输出质量是否满足要求
3. 如果有失败，是否需要重试

用结构化 JSON 格式返回审查报告。`,
        {
          structuredOutput: { schema: ReviewReportSchema },
        }
      );

      return response.object;
    },
  });
}