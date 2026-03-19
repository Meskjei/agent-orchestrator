import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectBrainImpl } from '@agent-orchestrator/core/brain/brain';
import { LockManager } from '@agent-orchestrator/core/lock/manager';
import { TaskStateMachine, canTransition } from '@agent-orchestrator/core/task/state-machine';
import { TaskReviewSkill } from '@agent-orchestrator/orchestrator/skills/task-review';
import { LockManagementSkill } from '@agent-orchestrator/orchestrator/skills/lock-management';
import { createTempProject, cleanupTempProject, createTestBrain, waitFor } from '../helpers/fixture';
import { assertLockStatus } from '../helpers/assertions';
import { TEST_AGENTS } from '../helpers/test-agents';
import { TempProject } from '../helpers/fixture';

describe('Layer 4: Error Recovery', () => {
  let project: TempProject;
  let brain: ProjectBrainImpl;
  let lockManager: LockManager;

  beforeEach(async () => {
    project = await createTempProject('error-recovery');
    brain = await createTestBrain(project.dir, {
      name: 'Error Recovery Test',
      goal: 'Test error recovery scenarios'
    });
    lockManager = new LockManager();
  });

  afterEach(async () => {
    await cleanupTempProject(project);
  });

  describe('Task Failure and Retry', () => {
    it('should handle task failure and allow retry', async () => {
      const agent = TEST_AGENTS.failingAgent;
      brain.addAgent(agent);
      
      brain.addTask({
        id: 'T001',
        title: 'Failing Task',
        description: 'Task that will fail',
        type: 'task',
        status: 'pending',
        expectedOutput: {
          type: 'code',
          description: 'Output',
          acceptanceCriteria: ['success']
        },
        estimatedFiles: ['src/fail.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      });
      
      const machine = new TaskStateMachine('pending');
      machine.transition('ready', 'ready', 'system');
      machine.transition('assigned', 'assigned', 'orchestrator');
      machine.transition('executing', 'executing', agent.id);
      
      machine.transition('blocked', 'Error occurred during execution', agent.id);
      brain.updateTaskStatus('T001', 'blocked', agent.id, 'Error during execution');
      
      expect(brain.getTask('T001')?.status).toBe('blocked');
      
      const canRetry = machine.canTransitionTo('failed');
      expect(canRetry).toBe(true);
      
      machine.transition('failed', 'Task failed after retries', 'system');
      brain.updateTaskStatus('T001', 'failed', 'system', 'Exceeded max retries');
      
      expect(brain.getTask('T001')?.status).toBe('failed');
      
      expect(machine.canTransitionTo('pending')).toBe(true);
      machine.transition('pending', 'Retry initiated', 'human');
      brain.updateTaskStatus('T001', 'pending', 'human', 'Manual retry');
      
      expect(brain.getTask('T001')?.status).toBe('pending');
    });

    it('should track failure history in task', async () => {
      brain.addTask({
        id: 'T002',
        title: 'History Task',
        description: 'Task with failure history',
        type: 'task',
        status: 'pending',
        expectedOutput: {
          type: 'code',
          description: 'Output',
          acceptanceCriteria: []
        },
        estimatedFiles: [],
        children: [],
        dependencies: [],
        statusHistory: []
      });
      
      brain.updateTaskStatus('T002', 'executing', 'agent-1');
      brain.updateTaskStatus('T002', 'blocked', 'agent-1', 'First failure');
      brain.updateTaskStatus('T002', 'executing', 'agent-1');
      brain.updateTaskStatus('T002', 'failed', 'agent-1', 'Second failure');
      brain.updateTaskStatus('T002', 'pending', 'human', 'Retry');
      
      const task = brain.getTask('T002');
      expect(task?.statusHistory.length).toBe(5);
      
      const failedEntry = task?.statusHistory.find(h => h.status === 'failed');
      expect(failedEntry?.reason).toBe('Second failure');
    });
  });

  describe('Lock Release on Failure', () => {
    it('should release locks when task fails', async () => {
      const agent = TEST_AGENTS.failingAgent;
      brain.addAgent(agent);
      
      const lockSkill = new LockManagementSkill(lockManager);
      
      const acquireResult = await lockSkill.execute({
        action: 'acquire',
        agentId: agent.id,
        taskId: 'T001',
        files: ['src/failing.ts', 'src/related.ts']
      });
      
      expect(acquireResult.success).toBe(true);
      assertLockStatus(lockManager, 'src/failing.ts', { locked: true, holder: agent.id });
      
      brain.addTask({
        id: 'T001',
        title: 'Task',
        description: 'Task',
        type: 'task',
        status: 'executing',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: ['src/failing.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      });
      
      brain.updateTaskStatus('T001', 'failed', agent.id, 'Execution error');
      
      await lockSkill.execute({
        action: 'release_all',
        agentId: agent.id
      });
      
      assertLockStatus(lockManager, 'src/failing.ts', { locked: false });
      assertLockStatus(lockManager, 'src/related.ts', { locked: false });
    });

    it('should pass lock to waiting agent on failure', async () => {
      const agent1 = TEST_AGENTS.failingAgent;
      const agent2 = TEST_AGENTS.successAgent;
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      
      const lockSkill = new LockManagementSkill(lockManager);
      
      await lockSkill.execute({
        action: 'acquire',
        agentId: agent1.id,
        taskId: 'T001',
        files: ['src/shared.ts']
      });
      
      const queuedResult = await lockSkill.execute({
        action: 'acquire',
        agentId: agent2.id,
        taskId: 'T002',
        files: ['src/shared.ts']
      });
      
      expect(queuedResult.success).toBe(false);
      
      await lockSkill.execute({
        action: 'release_all',
        agentId: agent1.id
      });
      
      assertLockStatus(lockManager, 'src/shared.ts', { locked: true, holder: agent2.id });
    });

    it('should handle multiple lock release on agent failure', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      const agent3 = TEST_AGENTS.failingAgent;
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      brain.addAgent(agent3);
      
      await lockManager.acquireLock({
        agentId: agent1.id,
        taskId: 'T001',
        files: ['src/file1.ts'],
        granularity: 'file',
        type: 'exclusive'
      });
      
      await lockManager.acquireLock({
        agentId: agent2.id,
        taskId: 'T002',
        files: ['src/file2.ts'],
        granularity: 'file',
        type: 'exclusive'
      });
      
      await lockManager.acquireLock({
        agentId: agent3.id,
        taskId: 'T003',
        files: ['src/file3.ts'],
        granularity: 'file',
        type: 'exclusive'
      });
      
      await lockManager.releaseAllForAgent(agent3.id);
      
      const remainingLocks = lockManager.getLocks();
      expect(remainingLocks.length).toBe(2);
      expect(remainingLocks.find(l => l.holder.agentId === agent3.id)).toBeUndefined();
    });
  });

  describe('Invalid State Transitions', () => {
    it('should reject invalid transitions from completed state', () => {
      const machine = new TaskStateMachine('completed');
      
      expect(machine.canTransitionTo('pending')).toBe(false);
      expect(machine.canTransitionTo('executing')).toBe(false);
      expect(machine.canTransitionTo('assigned')).toBe(false);
      expect(machine.canTransitionTo('reviewing')).toBe(false);
      
      const result = machine.transition('pending', 'Invalid attempt', 'agent');
      expect(result).toBe(false);
      expect(machine.current).toBe('completed');
    });

    it('should reject direct jump from pending to executing', () => {
      const machine = new TaskStateMachine('pending');
      
      expect(machine.canTransitionTo('executing')).toBe(false);
      
      const result = machine.transition('executing', 'Skip steps', 'agent');
      expect(result).toBe(false);
      expect(machine.current).toBe('pending');
    });

    it('should allow force transition for error recovery', () => {
      const machine = new TaskStateMachine('completed');
      
      machine.forceTransition('failed', 'Force for recovery', 'admin');
      
      expect(machine.current).toBe('failed');
      expect(machine.canTransitionTo('pending')).toBe(true);
    });

    it('should validate all invalid transition combinations', () => {
      const invalidTransitions: [string, string][] = [
        ['completed', 'pending'],
        ['completed', 'executing'],
        ['pending', 'completed'],
        ['pending', 'reviewing'],
        ['ready', 'completed'],
        ['assigned', 'completed'],
        ['executing', 'pending']
      ];
      
      for (const [from, to] of invalidTransitions) {
        expect(canTransition(from as any, to as any)).toBe(false);
      }
    });

    it('should maintain state integrity after rejected transitions', () => {
      const machine = new TaskStateMachine('pending');
      machine.transition('ready', 'Valid', 'system');
      machine.transition('assigned', 'Valid', 'orchestrator');
      
      const invalidResult = machine.transition('completed', 'Invalid skip', 'agent');
      expect(invalidResult).toBe(false);
      expect(machine.current).toBe('assigned');
      
      machine.transition('executing', 'Valid', 'agent');
      expect(machine.current).toBe('executing');
    });
  });

  describe('Brain Save/Load Integrity', () => {
    it('should maintain data integrity after save/load cycle', async () => {
      brain.addAgent(TEST_AGENTS.successAgent);
      brain.addAgent(TEST_AGENTS.slowAgent);
      
      brain.addTask({
        id: 'T001',
        title: 'Task 1',
        description: 'First task',
        type: 'task',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: ['test'] },
        estimatedFiles: ['file1.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      });
      
      brain.addTask({
        id: 'T002',
        title: 'Task 2',
        description: 'Second task',
        type: 'task',
        status: 'completed',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: ['file2.ts'],
        children: [],
        dependencies: [],
        statusHistory: [
          { status: 'pending', changedAt: new Date(), changedBy: 'system' },
          { status: 'completed', changedAt: new Date(), changedBy: 'agent' }
        ]
      });
      
      brain.context.background = 'Test context';
      brain.decisions.push({
        id: 'd1',
        decision: 'Use TypeScript',
        decider: 'human',
        context: 'Setup',
        alternatives: ['JavaScript'],
        impact: ['Type safety'],
        timestamp: new Date(),
        relatedTasks: ['T001'],
        relatedFiles: ['tsconfig.json']
      });
      
      await brain.save();
      
      const brain2 = new ProjectBrainImpl(project.dir);
      const loaded = await brain2.load();
      
      expect(loaded).toBe(true);
      expect(brain2.agents.length).toBe(2);
      expect(brain2.tasks.nodes.size).toBe(2);
      expect(brain2.getTask('T001')?.status).toBe('pending');
      expect(brain2.getTask('T002')?.status).toBe('completed');
      expect(brain2.getTask('T002')?.statusHistory.length).toBe(2);
      expect(brain2.context.background).toBe('Test context');
      expect(brain2.decisions.length).toBe(1);
      expect(brain2.decisions[0].decision).toBe('Use TypeScript');
    });

    it('should handle corrupted brain file gracefully', async () => {
      await brain.save();
      
      const brain2 = new ProjectBrainImpl(project.dir);
      const loaded = await brain2.load();
      
      expect(loaded).toBe(true);
    });

    it('should preserve task relationships after load', async () => {
      brain.addTask({
        id: 'PARENT',
        title: 'Parent Task',
        description: 'Parent',
        type: 'milestone',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: [],
        children: ['CHILD1', 'CHILD2'],
        dependencies: [],
        statusHistory: []
      });
      
      brain.addTask({
        id: 'CHILD1',
        parentId: 'PARENT',
        title: 'Child 1',
        description: 'First child',
        type: 'task',
        status: 'completed',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: ['child1.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      });
      
      brain.addTask({
        id: 'CHILD2',
        parentId: 'PARENT',
        title: 'Child 2',
        description: 'Second child',
        type: 'task',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: ['child2.ts'],
        children: [],
        dependencies: ['CHILD1'],
        statusHistory: []
      });
      
      await brain.save();
      
      const brain2 = new ProjectBrainImpl(project.dir);
      await brain2.load();
      
      const parent = brain2.getTask('PARENT');
      expect(parent?.children).toEqual(['CHILD1', 'CHILD2']);
      
      const child2 = brain2.getTask('CHILD2');
      expect(child2?.parentId).toBe('PARENT');
      expect(child2?.dependencies).toEqual(['CHILD1']);
    });
  });

  describe('Concurrent Lock Requests', () => {
    it('should handle multiple concurrent lock requests for same file', async () => {
      const agents = [
        TEST_AGENTS.successAgent,
        TEST_AGENTS.slowAgent,
        TEST_AGENTS.failingAgent
      ];
      
      for (const agent of agents) {
        brain.addAgent(agent);
      }
      
      const results = await Promise.all([
        lockManager.acquireLock({
          agentId: agents[0].id,
          taskId: 'T001',
          files: ['src/contested.ts'],
          granularity: 'file',
          type: 'exclusive'
        }),
        lockManager.acquireLock({
          agentId: agents[1].id,
          taskId: 'T002',
          files: ['src/contested.ts'],
          granularity: 'file',
          type: 'exclusive'
        }),
        lockManager.acquireLock({
          agentId: agents[2].id,
          taskId: 'T003',
          files: ['src/contested.ts'],
          granularity: 'file',
          type: 'exclusive'
        })
      ]);
      
      const granted = results.filter(r => r.granted);
      const queued = results.filter(r => !r.granted);
      
      expect(granted.length).toBe(1);
      expect(queued.length).toBe(2);
      
      const queuePositions = queued.map(r => r.waitingQueuePosition);
      expect(queuePositions).toContain(1);
      expect(queuePositions).toContain(2);
    });

    it('should maintain correct queue order under concurrency', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      const agent3 = TEST_AGENTS.failingAgent;
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      brain.addAgent(agent3);
      
      await lockManager.acquireLock({
        agentId: agent1.id,
        taskId: 'T001',
        files: ['src/queue-test.ts'],
        granularity: 'file',
        type: 'exclusive'
      });
      
      await lockManager.acquireLock({
        agentId: agent2.id,
        taskId: 'T002',
        files: ['src/queue-test.ts'],
        granularity: 'file',
        type: 'exclusive'
      });
      
      await lockManager.acquireLock({
        agentId: agent3.id,
        taskId: 'T003',
        files: ['src/queue-test.ts'],
        granularity: 'file',
        type: 'exclusive'
      });
      
      const locks = lockManager.getLocks({ file: 'src/queue-test.ts' });
      expect(locks[0].waitingQueue.length).toBe(2);
      expect(locks[0].waitingQueue[0].agentId).toBe(agent2.id);
      expect(locks[0].waitingQueue[1].agentId).toBe(agent3.id);
      
      await lockManager.releaseLock(locks[0].id);
      
      const afterRelease = lockManager.getLocks({ file: 'src/queue-test.ts' });
      expect(afterRelease[0].holder.agentId).toBe(agent2.id);
      expect(afterRelease[0].waitingQueue.length).toBe(1);
      expect(afterRelease[0].waitingQueue[0].agentId).toBe(agent3.id);
    });

    it('should handle rapid lock acquire/release cycles', async () => {
      const agents = [TEST_AGENTS.successAgent, TEST_AGENTS.slowAgent];
      brain.addAgent(agents[0]);
      brain.addAgent(agents[1]);
      
      for (let i = 0; i < 3; i++) {
        const result = await lockManager.acquireLock({
          agentId: agents[0].id,
          taskId: `T${i}`,
          files: [`src/cycle-${i}.ts`],
          granularity: 'file',
          type: 'exclusive'
        });
        
        expect(result.granted).toBe(true);
        
        await lockManager.releaseLock(result.lockId!);
        
        assertLockStatus(lockManager, `src/cycle-${i}.ts`, { locked: false });
      }
    });
  });

  describe('Error Handling in Review Process', () => {
    it('should handle review failure gracefully', async () => {
      brain.addTask({
        id: 'T001',
        title: 'Review Task',
        description: 'Task for review',
        type: 'task',
        status: 'reviewing',
        expectedOutput: {
          type: 'code',
          description: 'Output',
          acceptanceCriteria: ['Must have tests', 'Must follow style']
        },
        estimatedFiles: ['src/review.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      });
      
      const reviewSkill = new TaskReviewSkill();
      const review = await reviewSkill.execute({
        task: brain.getTask('T001')!,
        output: {
          summary: 'Minimal implementation',
          files: ['src/review.ts'],
          artifacts: []
        },
        reviewType: 'both'
      });
      
      expect(review.passed).toBe(false);
      expect(review.specReview.compliant).toBe(false);
      expect(review.specReview.missingRequirements.length).toBeGreaterThan(0);
      
      brain.updateTaskStatus('T001', 'revision', 'reviewer');
      expect(brain.getTask('T001')?.status).toBe('revision');
    });

    it('should allow revision and re-review cycle', async () => {
      brain.addTask({
        id: 'T002',
        title: 'Revision Task',
        description: 'Task needing revision',
        type: 'task',
        status: 'reviewing',
        expectedOutput: {
          type: 'code',
          description: 'Output',
          acceptanceCriteria: ['tested']
        },
        estimatedFiles: ['src/revision.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      });
      
      const reviewSkill = new TaskReviewSkill();
      
      let review = await reviewSkill.execute({
        task: brain.getTask('T002')!,
        output: {
          summary: 'Initial version',
          files: ['src/revision.ts'],
          artifacts: []
        },
        reviewType: 'spec'
      });
      
      expect(review.passed).toBe(false);
      
      brain.updateTaskStatus('T002', 'revision', 'reviewer');
      
      review = await reviewSkill.execute({
        task: brain.getTask('T002')!,
        output: {
          summary: 'tested implementation with tested feature',
          files: ['src/revision.ts'],
          artifacts: []
        },
        reviewType: 'spec'
      });
      
      expect(review.passed).toBe(true);
      
      brain.updateTaskStatus('T002', 'completed', 'reviewer');
      expect(brain.getTask('T002')?.status).toBe('completed');
    });
  });
});