import { LockManager, TaskNode, LockGranularity, LockType } from '@agent-orchestrator/core';
import { CliAdapter, AdapterContext } from '@agent-orchestrator/adapter';

export interface DispatchContext {
  projectGoal: string;
  agentRole: string;
  relevantCodeSnippets: Array<{ file: string; content: string; language: string }>;
  relatedOutputs: Array<{ taskId: string; agentId: string; summary: string }>;
  currentLocks: Array<{ file: string; holder: string }>;
}

export interface DispatchInput {
  agentId: string;
  task: TaskNode;
  context: DispatchContext;
}

export interface DispatchOutput {
  summary: string;
  files: string[];
  artifacts: string[];
}

export interface DispatchResult {
  status: 'completed' | 'blocked' | 'failed' | 'needs_clarification';
  output: DispatchOutput;
  locksAcquired: string[];
  locksReleased: string[];
  questions?: string[];
}

export class AgentDispatchSkill {
  private lockManager: LockManager;
  private adapters: Record<string, CliAdapter>;

  constructor(lockManager: LockManager, adapters: Record<string, CliAdapter>) {
    this.lockManager = lockManager;
    this.adapters = adapters;
  }

  async execute(input: DispatchInput): Promise<DispatchResult> {
    const { agentId, task, context } = input;

    const adapter = this.adapters[agentId];
    if (!adapter) {
      return {
        status: 'failed',
        output: {
          summary: `No adapter found for agent: ${agentId}`,
          files: [],
          artifacts: []
        },
        locksAcquired: [],
        locksReleased: []
      };
    }

    const estimatedFiles = task.estimatedFiles || [];
    let lockId: string | undefined;

    if (estimatedFiles.length > 0) {
      const lockResult = await this.lockManager.acquireLock({
        agentId,
        taskId: task.id,
        files: estimatedFiles,
        granularity: 'file' as LockGranularity,
        type: 'exclusive' as LockType
      });

      if (!lockResult.granted) {
        return {
          status: 'blocked',
          output: {
            summary: lockResult.reason || 'Could not acquire locks',
            files: [],
            artifacts: []
          },
          locksAcquired: [],
          locksReleased: [],
          questions: [`Task blocked: ${lockResult.reason}`]
        };
      }

      lockId = lockResult.lockId;
    }

    const adapterContext: AdapterContext = {
      task: this.buildTaskPrompt(task),
      context: {
        projectGoal: context.projectGoal,
        agentRole: context.agentRole,
        codeSnippets: context.relevantCodeSnippets,
        locks: context.currentLocks,
        relatedOutputs: context.relatedOutputs.map(o => ({
          taskId: o.taskId,
          agentId: o.agentId,
          summary: o.summary
        }))
      }
    };

    try {
      const result = await adapter.execute(adapterContext);

      const locksReleased: string[] = [];
      if (lockId) {
        await this.lockManager.releaseLock(lockId);
        locksReleased.push(lockId);
      }

      if (result.error) {
        return {
          status: 'failed',
          output: {
            summary: result.output,
            files: [],
            artifacts: result.artifacts || []
          },
          locksAcquired: lockId ? [lockId] : [],
          locksReleased,
          questions: [result.error]
        };
      }

      return {
        status: 'completed',
        output: {
          summary: result.output,
          files: [],
          artifacts: result.artifacts || []
        },
        locksAcquired: lockId ? [lockId] : [],
        locksReleased
      };
    } catch (error) {
      if (lockId) {
        await this.lockManager.releaseLock(lockId);
      }

      return {
        status: 'failed',
        output: {
          summary: `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
          files: [],
          artifacts: []
        },
        locksAcquired: lockId ? [lockId] : [],
        locksReleased: lockId ? [lockId] : []
      };
    }
  }

  private buildTaskPrompt(task: TaskNode): string {
    const parts: string[] = [];

    parts.push(`Task: ${task.title}`);
    parts.push(`Description: ${task.description}`);
    
    if (task.expectedOutput) {
      parts.push(`Expected Output: ${task.expectedOutput.description}`);
      if (task.expectedOutput.acceptanceCriteria.length > 0) {
        parts.push(`Acceptance Criteria:\n${task.expectedOutput.acceptanceCriteria.map(c => `- ${c}`).join('\n')}`);
      }
    }

    return parts.join('\n\n');
  }
}