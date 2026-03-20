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
    .then(dispatchStep)
    .then(reviewStep);

  workflow.commit();

  return workflow;
}