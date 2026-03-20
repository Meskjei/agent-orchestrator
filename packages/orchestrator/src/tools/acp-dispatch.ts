import { createTool } from '@mastra/core/tools';
import { ACPGateway } from '@agent-orchestrator/acp';
import { z } from 'zod';

export function createDispatchTool(gateway: ACPGateway) {
  return createTool({
    id: 'acp-dispatch',
    description: '派发任务给 Worker Agent 执行。选择 agentId，提供任务 prompt 和工作目录。',
    inputSchema: z.object({
      agentId: z.string().describe('Agent ID，如 opencode, claude'),
      prompt: z.string().describe('要执行的任务描述'),
      cwd: z.string().describe('工作目录路径'),
      files: z.array(z.string()).optional().describe('需要锁定的文件列表'),
    }),
    execute: async (inputData) => {
      const result = await gateway.dispatch({
        agentId: inputData.agentId,
        prompt: inputData.prompt,
        cwd: inputData.cwd,
        files: inputData.files,
      });
      return result;
    },
  });
}