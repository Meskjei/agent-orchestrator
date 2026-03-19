import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectBrainImpl } from '@agent-orchestrator/core/brain/brain';
import { LockManager } from '@agent-orchestrator/core/lock/manager';
import { TaskStateMachine, canTransition } from '@agent-orchestrator/core/task/state-machine';
import { TaskDecompositionSkill } from '@agent-orchestrator/orchestrator/skills/task-decomposition';
import { TaskReviewSkill } from '@agent-orchestrator/orchestrator/skills/task-review';
import { LockManagementSkill } from '@agent-orchestrator/orchestrator/skills/lock-management';
import { createTempProject, cleanupTempProject, createTestBrain } from '../helpers/fixture';
import { assertBrainPersisted, assertLockStatus, assertTaskStatusHistory } from '../helpers/assertions';
import { TEST_AGENTS } from '../helpers/test-agents';
import { TempProject } from '../helpers/fixture';

describe('Layer 4: Single Agent Lifecycle', () => {
  let project: TempProject;
  let brain: ProjectBrainImpl;
  let lockManager: LockManager;

  beforeEach(async () => {
    project = await createTempProject('single-agent-lifecycle');
    brain = await createTestBrain(project.dir, {
      name: 'Single Agent Test',
      goal: 'Test complete single agent lifecycle'
    });
    lockManager = new LockManager();
  });

  afterEach(async () => {
    await cleanupTempProject(project);
  });

  describe('Complete Lifecycle Flow', () => {
    it('should complete full lifecycle: register -> create -> decompose -> assign -> lock -> execute -> review -> complete -> release', async () => {
      const agent = TEST_AGENTS.successAgent;
      
      brain.addAgent(agent);
      expect(brain.agents.length).toBe(1);
      expect(brain.agents[0].id).toBe(agent.id);

      brain.addTask({
        id: 'T001',
        title: 'Implement Feature X',
        description: 'Implement a new feature with tests',
        type: 'task',
        status: 'pending',
        expectedOutput: {
          type: 'code',
          description: 'Feature implementation',
          acceptanceCriteria: ['Works correctly', 'Has tests']
        },
        estimatedFiles: ['src/feature.ts', 'tests/feature.test.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      });

      const task = brain.getTask('T001');
      expect(task).toBeDefined();
      expect(task?.status).toBe('pending');

      const decompositionSkill = new TaskDecompositionSkill();
      const decomposition = await decompositionSkill.execute({
        taskDescription: 'Implement Feature X',
        goal: 'Complete feature implementation',
        constraints: [],
        availableAgents: brain.agents
      });

      expect(decomposition.subtasks.length).toBeGreaterThan(0);

      for (const subtask of decomposition.subtasks) {
        brain.addTask({
          id: subtask.id,
          parentId: 'T001',
          title: subtask.title,
          description: subtask.description,
          type: subtask.type,
          status: 'pending',
          expectedOutput: {
            type: 'code',
            description: subtask.description,
            acceptanceCriteria: []
          },
          estimatedFiles: subtask.estimatedFiles,
          children: [],
          dependencies: subtask.dependencies || [],
          statusHistory: []
        });
      }

      const parentTask = brain.getTask('T001')!;
      parentTask.children = decomposition.subtasks.map(s => s.id);

      const lockSkill = new LockManagementSkill(lockManager);
      const acquireResult = await lockSkill.execute({
        action: 'acquire',
        agentId: agent.id,
        taskId: 'T001',
        files: ['src/feature.ts', 'tests/feature.test.ts']
      });

      expect(acquireResult.success).toBe(true);
      expect(acquireResult.lockId).toBeDefined();

      assertLockStatus(lockManager, 'src/feature.ts', { locked: true, holder: agent.id });

      const stateMachine = new TaskStateMachine('pending');
      expect(stateMachine.transition('ready', 'Dependencies met', 'system')).toBe(true);
      expect(stateMachine.transition('assigned', `Assigned to ${agent.id}`, 'orchestrator')).toBe(true);

      brain.updateTaskStatus('T001', 'assigned', 'orchestrator');
      const assignedTask = brain.getTask('T001');
      expect(assignedTask?.status).toBe('assigned');

      brain.updateTaskStatus('T001', 'executing', agent.id);
      const executingTask = brain.getTask('T001');
      expect(executingTask?.status).toBe('executing');

      expect(stateMachine.transition('executing', 'Agent started work', agent.id)).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 100));

      brain.updateTaskStatus('T001', 'reviewing', agent.id);
      const reviewingTask = brain.getTask('T001');
      expect(reviewingTask?.status).toBe('reviewing');

      const reviewSkill = new TaskReviewSkill();
      const review = await reviewSkill.execute({
        task: brain.getTask('T001')!,
        output: {
          summary: 'Feature implemented with Works correctly and Has tests',
          files: ['src/feature.ts', 'tests/feature.test.ts'],
          artifacts: ['coverage-report.html']
        },
        reviewType: 'both'
      });

      expect(review.passed).toBe(true);
      expect(review.specReview.compliant).toBe(true);

      if (review.passed) {
        brain.updateTaskStatus('T001', 'completed', 'reviewer');
      }

      const completedTask = brain.getTask('T001');
      expect(completedTask?.status).toBe('completed');

      const releaseResult = await lockSkill.execute({
        action: 'release',
        agentId: agent.id,
        files: ['src/feature.ts', 'tests/feature.test.ts']
      });

      expect(releaseResult.success).toBe(true);
      assertLockStatus(lockManager, 'src/feature.ts', { locked: false });

      await brain.save();
      await assertBrainPersisted(project.dir, {
        name: 'Single Agent Test',
        agentCount: 1,
        taskCount: brain.tasks.nodes.size
      });

      const finalTask = brain.getTask('T001');
      assertTaskStatusHistory(finalTask!, [
        'assigned', 'executing', 'reviewing', 'completed'
      ]);
    });

    it('should track status history throughout lifecycle', async () => {
      const agent = TEST_AGENTS.successAgent;
      brain.addAgent(agent);

      brain.addTask({
        id: 'T002',
        title: 'History Test Task',
        description: 'Test status history tracking',
        type: 'task',
        status: 'pending',
        expectedOutput: {
          type: 'code',
          description: 'Test output',
          acceptanceCriteria: ['test']
        },
        estimatedFiles: [],
        children: [],
        dependencies: [],
        statusHistory: []
      });

      brain.updateTaskStatus('T002', 'ready', 'system', 'All dependencies resolved');
      brain.updateTaskStatus('T002', 'assigned', 'orchestrator', 'Assigned to agent');
      brain.updateTaskStatus('T002', 'executing', agent.id, 'Work started');
      brain.updateTaskStatus('T002', 'reviewing', agent.id, 'Work completed');

      const task = brain.getTask('T002')!;
      expect(task.statusHistory.length).toBe(4);
      
      expect(task.statusHistory[0].status).toBe('ready');
      expect(task.statusHistory[0].reason).toBe('All dependencies resolved');
      
      expect(task.statusHistory[3].status).toBe('reviewing');
      expect(task.statusHistory[3].changedBy).toBe(agent.id);
    });
  });

  describe('State Machine Transitions', () => {
    it('should allow valid state transitions for single agent task', () => {
      const machine = new TaskStateMachine('pending');
      
      expect(canTransition('pending', 'ready')).toBe(true);
      expect(machine.transition('ready', 'ready')).toBe(true);
      
      expect(canTransition('ready', 'assigned')).toBe(true);
      expect(machine.transition('assigned', 'assigned')).toBe(true);
      
      expect(canTransition('assigned', 'executing')).toBe(true);
      expect(machine.transition('executing', 'executing')).toBe(true);
      
      expect(canTransition('executing', 'reviewing')).toBe(true);
      expect(machine.transition('reviewing', 'reviewing')).toBe(true);
      
      expect(canTransition('reviewing', 'completed')).toBe(true);
      expect(machine.transition('completed', 'completed')).toBe(true);
      
      expect(machine.current).toBe('completed');
    });

    it('should reject invalid state transitions', () => {
      const machine = new TaskStateMachine('completed');
      
      expect(machine.canTransitionTo('pending')).toBe(false);
      expect(machine.canTransitionTo('executing')).toBe(false);
      expect(machine.canTransitionTo('assigned')).toBe(false);
      
      const machine2 = new TaskStateMachine('pending');
      expect(machine2.canTransitionTo('executing')).toBe(false);
      expect(machine2.canTransitionTo('completed')).toBe(false);
    });

    it('should handle blocked and failed states', () => {
      const machine = new TaskStateMachine('pending');
      
      expect(machine.transition('blocked', 'Blocked by dependency', 'system')).toBe(true);
      expect(machine.current).toBe('blocked');
      
      expect(machine.canTransitionTo('failed')).toBe(true);
      expect(machine.transition('failed', 'Failed after timeout', 'system')).toBe(true);
      
      expect(machine.canTransitionTo('pending')).toBe(true);
      expect(machine.transition('pending', 'Retry', 'system')).toBe(true);
    });
  });

  describe('Lock Lifecycle for Single Agent', () => {
    it('should acquire and release multiple file locks', async () => {
      const agent = TEST_AGENTS.successAgent;
      brain.addAgent(agent);
      
      const result1 = await lockManager.acquireLock({
        agentId: agent.id,
        taskId: 'T001',
        files: ['file1.ts'],
        granularity: 'file',
        type: 'exclusive'
      });
      
      const result2 = await lockManager.acquireLock({
        agentId: agent.id,
        taskId: 'T001',
        files: ['file2.ts'],
        granularity: 'file',
        type: 'exclusive'
      });
      
      const result3 = await lockManager.acquireLock({
        agentId: agent.id,
        taskId: 'T001',
        files: ['file3.ts'],
        granularity: 'file',
        type: 'exclusive'
      });
      
      expect(result1.granted).toBe(true);
      expect(result2.granted).toBe(true);
      expect(result3.granted).toBe(true);
      
      const locks = lockManager.getLocks({ agentId: agent.id });
      expect(locks.length).toBe(3);
      
      assertLockStatus(lockManager, 'file1.ts', { locked: true, holder: agent.id });
      assertLockStatus(lockManager, 'file2.ts', { locked: true, holder: agent.id });
      assertLockStatus(lockManager, 'file3.ts', { locked: true, holder: agent.id });
      
      await lockManager.releaseLock(result1.lockId!);
      
      assertLockStatus(lockManager, 'file1.ts', { locked: false });
      assertLockStatus(lockManager, 'file2.ts', { locked: true, holder: agent.id });
      
      await lockManager.releaseAllForAgent(agent.id);
      
      const remainingLocks = lockManager.getLocks({ agentId: agent.id });
      expect(remainingLocks.length).toBe(0);
    });

    it('should handle lock expiry', async () => {
      const agent = TEST_AGENTS.successAgent;
      brain.addAgent(agent);
      
      const result = await lockManager.acquireLock({
        agentId: agent.id,
        taskId: 'T001',
        files: ['expiring-file.ts'],
        granularity: 'file',
        type: 'exclusive',
        expiresIn: 100
      });
      
      expect(result.granted).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      await lockManager.cleanupExpired();
      
      assertLockStatus(lockManager, 'expiring-file.ts', { locked: false });
    });
  });

  describe('Brain Persistence During Lifecycle', () => {
    it('should persist agent and task state correctly', async () => {
      const agent = TEST_AGENTS.successAgent;
      brain.addAgent(agent);
      
      brain.addTask({
        id: 'T003',
        title: 'Persistence Test',
        description: 'Test persistence',
        type: 'task',
        status: 'pending',
        expectedOutput: {
          type: 'code',
          description: 'Output',
          acceptanceCriteria: ['persisted']
        },
        estimatedFiles: ['persist.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      });
      
      brain.updateTaskStatus('T003', 'executing', agent.id);
      
      await brain.save();
      
      const brain2 = new ProjectBrainImpl(project.dir);
      const loaded = await brain2.load();
      
      expect(loaded).toBe(true);
      expect(brain2.agents.length).toBe(1);
      expect(brain2.agents[0].id).toBe(agent.id);
      
      const loadedTask = brain2.getTask('T003');
      expect(loadedTask).toBeDefined();
      expect(loadedTask?.status).toBe('executing');
      expect(loadedTask?.statusHistory.length).toBe(1);
    });

    it('should maintain context and decisions through lifecycle', async () => {
      brain.context.background = 'Test project for lifecycle testing';
      
      brain.decisions.push({
        id: 'decision-1',
        decision: 'Use TypeScript',
        decider: 'human',
        context: 'Tech stack selection',
        alternatives: ['JavaScript'],
        impact: ['Type safety'],
        timestamp: new Date(),
        relatedTasks: [],
        relatedFiles: []
      });
      
      await brain.save();
      
      const brain2 = new ProjectBrainImpl(project.dir);
      await brain2.load();
      
      expect(brain2.context.background).toBe('Test project for lifecycle testing');
      expect(brain2.decisions.length).toBe(1);
      expect(brain2.decisions[0].decision).toBe('Use TypeScript');
    });
  });
});