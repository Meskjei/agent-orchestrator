import { Agent } from '@mastra/core/agent';
import { ACPGateway } from '@agent-orchestrator/acp';
import { BrainLLMConfig, createLLM } from './config.js';
import { createDispatchTool } from './tools/acp-dispatch.js';
import { createCancelTool } from './tools/acp-cancel.js';
import { createStatusTool } from './tools/acp-status.js';
import { createListAgentsTool } from './tools/acp-list-agents.js';
import { createLockQueryTool } from './tools/lock-query.js';
import { createOrchestratorWorkflow } from './workflow/orchestrator-workflow.js';

export interface BrainConfig {
  llm: BrainLLMConfig;
  maxConcurrentTasks: number;
}

export function createBrain(config: BrainConfig) {
  const gateway = new ACPGateway();
  const model = createLLM(config.llm);

  const dispatchTool = createDispatchTool(gateway);
  const cancelTool = createCancelTool(gateway);
  const statusTool = createStatusTool(gateway);
  const listAgentsTool = createListAgentsTool(gateway);
  const lockQueryTool = createLockQueryTool(gateway);

  const agent = new Agent({
    id: 'orchestrator-brain',
    name: 'Orchestrator Brain',
    instructions: `你是一个任务编排代理。你的职责是：
1. 分析复杂任务，分解为可执行的子任务
2. 根据 Agent 能力选择合适的 Worker
3. 分派任务并监控执行
4. 审查结果确保质量
5. 管理文件锁防止冲突

工作流程：
1. 使用 acp-list-agents 查看可用 Worker
2. 使用 lock-query 检查文件锁状态
3. 使用 acp-dispatch 派发任务给 Worker
4. 使用 acp-status 检查 Worker 执行状态
5. 使用 acp-cancel 取消不需要的 Worker`,
    model,
    tools: {
      dispatchTool,
      cancelTool,
      statusTool,
      listAgentsTool,
      lockQueryTool,
    },
  });

  const workflow = createOrchestratorWorkflow(agent, gateway);

  return { agent, gateway, workflow };
}