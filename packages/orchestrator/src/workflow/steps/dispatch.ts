import { createStep } from '@mastra/core/workflows';
import { ACPGateway } from '@agent-orchestrator/acp';
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
  subtasks: z.array(SubtaskSchema),
  cwd: z.string(),
  task: z.string(),
});

export function createDispatchStep(gateway: ACPGateway) {
  return createStep({
    id: 'dispatch',
    description: '并发派发子任务给 Worker',
    inputSchema,
    outputSchema: outputSchema.omit({ task: true }),
    execute: async ({ inputData }) => {
      const subtasks = inputData.subtasks;

      const noDeps = subtasks.filter(st => !st.dependsOn?.length);
      const withDeps = subtasks.filter(st => st.dependsOn?.length);

      const results: Array<{ workerId: string; output: string; error?: string }> = [];
      const failed: number[] = [];

      // 无依赖的子任务并发执行
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
          const r = batchResults[i];
          results.push({ workerId: r.workerId, output: r.output, error: r.error });
          if (r.error) failed.push(noDeps[i].id);
        }
      }

      // 有依赖的子任务
      for (const st of withDeps) {
        const depFailed = st.dependsOn!.some(depId => failed.includes(depId));
        if (depFailed) {
          failed.push(st.id);
          results.push({ workerId: '', output: '', error: 'Skipped: dependency failed' });
          continue;
        }

        const r = await gateway.dispatch({
          agentId: st.agent,
          prompt: st.task,
          cwd: inputData.cwd,
          files: st.files,
        });

        results.push({ workerId: r.workerId, output: r.output, error: r.error });
        if (r.error) failed.push(st.id);
      }

      return { results, failed, subtasks: inputData.subtasks, cwd: inputData.cwd };
    },
  });
}