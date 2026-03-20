import { createTool } from '@mastra/core/tools';
import { ACPGateway } from '@agent-orchestrator/acp';
import { z } from 'zod';

export function createStatusTool(gateway: ACPGateway) {
  return createTool({
    id: 'acp-status',
    description: '查询 Worker 的执行状态',
    inputSchema: z.object({
      workerId: z.string().describe('Worker ID'),
    }),
    execute: async (inputData) => {
      return { status: gateway.getWorkerStatus(inputData.workerId) };
    },
  });
}