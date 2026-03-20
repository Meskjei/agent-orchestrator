import { createTool } from '@mastra/core/tools';
import { ACPGateway } from '@agent-orchestrator/acp';
import { z } from 'zod';

export function createLockQueryTool(gateway: ACPGateway) {
  return createTool({
    id: 'lock-query',
    description: '查询文件锁状态，判断文件是否被锁定',
    inputSchema: z.object({
      files: z.array(z.string()).describe('要查询的文件路径列表'),
    }),
    execute: async (inputData) => {
      return { locks: gateway.queryLock(inputData.files) };
    },
  });
}