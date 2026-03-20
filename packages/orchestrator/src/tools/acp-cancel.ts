import { createTool } from '@mastra/core/tools';
import { ACPGateway } from '@agent-orchestrator/acp';
import { z } from 'zod';

export function createCancelTool(gateway: ACPGateway) {
  return createTool({
    id: 'acp-cancel',
    description: '取消正在执行的 Worker',
    inputSchema: z.object({
      workerId: z.string().describe('Worker ID'),
    }),
    execute: async (inputData) => {
      await gateway.cancel(inputData.workerId);
      return { cancelled: true };
    },
  });
}