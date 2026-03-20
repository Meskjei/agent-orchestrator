export { orchestratorConfig, TaskDecompositionSkill } from './agent';
export { AgentDispatchSkill } from './skills/agent-dispatch';
export type { DispatchInput, DispatchResult, DispatchContext, DispatchOutput } from './skills/agent-dispatch';
export { LockManagementSkill } from './skills/lock-management';
export type { LockManagementInput, LockManagementResult } from './skills/lock-management';
export { TaskReviewSkill } from './skills/task-review';
export type { TaskOutput, ReviewInput, SpecReviewResult, QualityReviewResult, ReviewReport } from './skills/task-review';
export { DecisionLogSkill } from './skills/decision-log';
export type { DecisionInput, DecisionLogInput, DecisionLogResult } from './skills/decision-log';

export { createBrain } from './brain.js';
export type { BrainConfig } from './brain.js';
export { createOrchestratorWorkflow } from './workflow/orchestrator-workflow.js';
export { ACPGateway } from '@agent-orchestrator/acp';