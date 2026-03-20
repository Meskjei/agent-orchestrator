import { createTool } from '@mastra/core/tools';
import { ACPGateway } from '@agent-orchestrator/acp';
import { z } from 'zod';

export function createListAgentsTool(gateway: ACPGateway) {
  return createTool({
    id: 'acp-list-agents',
    description: '列出所有可用的 Worker Agent 及其能力',
    inputSchema: z.object({}),
    execute: async () => {
      return { agents: gateway.listAgents() };
    },
  });
}