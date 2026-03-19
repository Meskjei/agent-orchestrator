import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectBrainImpl } from '@agent-orchestrator/core/brain/brain';
import { LockManager } from '@agent-orchestrator/core/lock/manager';
import { TaskStateMachine } from '@agent-orchestrator/core/task/state-machine';
import { TaskDecompositionSkill } from '@agent-orchestrator/orchestrator/skills/task-decomposition';
import { TaskReviewSkill } from '@agent-orchestrator/orchestrator/skills/task-review';
import { LockManagementSkill } from '@agent-orchestrator/orchestrator/skills/lock-management';
import { createTempProject, cleanupTempProject, createTestBrain, waitFor } from '../helpers/fixture';
import { assertLockStatus } from '../helpers/assertions';
import { TEST_AGENTS } from '../helpers/test-agents';
import { TempProject } from '../helpers/fixture';
import { TaskNode } from '@agent-orchestrator/core/types';

describe('Layer 4: Multi-Agent Concurrent', () => {
  let project: TempProject;
  let brain: ProjectBrainImpl;
  let lockManager: LockManager;

  beforeEach(async () => {
    project = await createTempProject('multi-agent-concurrent');
    brain = await createTestBrain(project.dir, {
      name: 'Multi-Agent Test',
      goal: 'Test multi-agent collaboration'
    });
    lockManager = new LockManager();
  });

  afterEach(async () => {
    await cleanupTempProject(project);
  });

  describe('Agent Registration', () => {
    it('should register 3 agents with different capabilities', async () => {
      const agents = [TEST_AGENTS.successAgent, TEST_AGENTS.slowAgent, TEST_AGENTS.failingAgent];
      
      for (const agent of agents) {
        brain.addAgent(agent);
      }
      
      expect(brain.agents.length).toBe(3);
      
      const agentIds = brain.agents.map(a => a.id);
      expect(agentIds).toContain('success-agent');
      expect(agentIds).toContain('slow-agent');
      expect(agentIds).toContain('failing-agent');
      
      await brain.save();
      
      const brain2 = new ProjectBrainImpl(project.dir);
      await brain2.load();
      expect(brain2.agents.length).toBe(3);
    });

    it('should update agent status', async () => {
      brain.addAgent(TEST_AGENTS.successAgent);
      
      brain.addAgent({
        ...TEST_AGENTS.successAgent,
        status: 'busy',
        currentTask: 'T001'
      });
      
      const agent = brain.getAgent('success-agent');
      expect(agent?.status).toBe('busy');
      expect(agent?.currentTask).toBe('T001');
    });
  });

  describe('Task Creation with Shared Files', () => {
    it('should create 3 tasks with shared file dependencies', async () => {
      const sharedFile = 'src/shared/api.ts';
      
      const tasks: TaskNode[] = [
        {
          id: 'T001',
          title: 'Update API endpoint',
          description: 'Modify the API endpoint',
          type: 'task',
          status: 'pending',
          expectedOutput: {
            type: 'code',
            description: 'Updated API',
            acceptanceCriteria: ['Works']
          },
          estimatedFiles: [sharedFile],
          children: [],
          dependencies: [],
          statusHistory: []
        },
        {
          id: 'T002',
          title: 'Add API tests',
          description: 'Add tests for API',
          type: 'task',
          status: 'pending',
          expectedOutput: {
            type: 'code',
            description: 'API tests',
            acceptanceCriteria: ['Tests pass']
          },
          estimatedFiles: [sharedFile, 'tests/api.test.ts'],
          children: [],
          dependencies: [],
          statusHistory: []
        },
        {
          id: 'T003',
          title: 'Update API documentation',
          description: 'Update docs',
          type: 'task',
          status: 'pending',
          expectedOutput: {
            type: 'document',
            description: 'Updated docs',
            acceptanceCriteria: ['Accurate']
          },
          estimatedFiles: [sharedFile, 'docs/api.md'],
          children: [],
          dependencies: [],
          statusHistory: []
        }
      ];
      
      for (const task of tasks) {
        brain.addTask(task);
      }
      
      expect(brain.tasks.nodes.size).toBe(3);
      
      const tasksWithSharedFile = Array.from(brain.tasks.nodes.values())
        .filter(t => t.estimatedFiles.includes(sharedFile));
      expect(tasksWithSharedFile.length).toBe(3);
    });
  });

  describe('Lock Queuing', () => {
    it('should queue locks when first agent holds the lock', async () => {
      const sharedFile = 'src/shared/service.ts';
      const agents = [TEST_AGENTS.successAgent, TEST_AGENTS.slowAgent, TEST_AGENTS.failingAgent];
      
      for (const agent of agents) {
        brain.addAgent(agent);
      }
      
      const result1 = await lockManager.acquireLock({
        agentId: agents[0].id,
        taskId: 'T001',
        files: [sharedFile],
        granularity: 'file',
        type: 'exclusive'
      });
      
      expect(result1.granted).toBe(true);
      assertLockStatus(lockManager, sharedFile, { locked: true, holder: agents[0].id });
      
      const result2 = await lockManager.acquireLock({
        agentId: agents[1].id,
        taskId: 'T002',
        files: [sharedFile],
        granularity: 'file',
        type: 'exclusive'
      });
      
      expect(result2.granted).toBe(false);
      expect(result2.waitingQueuePosition).toBe(1);
      
      const result3 = await lockManager.acquireLock({
        agentId: agents[2].id,
        taskId: 'T003',
        files: [sharedFile],
        granularity: 'file',
        type: 'exclusive'
      });
      
      expect(result3.granted).toBe(false);
      expect(result3.waitingQueuePosition).toBe(2);
      
      const locks = lockManager.getLocks({ file: sharedFile });
      expect(locks[0].waitingQueue.length).toBe(2);
      expect(locks[0].waitingQueue[0].agentId).toBe(agents[1].id);
      expect(locks[0].waitingQueue[1].agentId).toBe(agents[2].id);
    });

    it('should pass lock to next agent when released', async () => {
      const sharedFile = 'src/shared/handler.ts';
      const agents = [TEST_AGENTS.successAgent, TEST_AGENTS.slowAgent];
      
      brain.addAgent(agents[0]);
      brain.addAgent(agents[1]);
      
      const result1 = await lockManager.acquireLock({
        agentId: agents[0].id,
        taskId: 'T001',
        files: [sharedFile],
        granularity: 'file',
        type: 'exclusive'
      });
      
      expect(result1.granted).toBe(true);
      expect(result1.lockId).toBeDefined();
      
      const result2 = await lockManager.acquireLock({
        agentId: agents[1].id,
        taskId: 'T002',
        files: [sharedFile],
        granularity: 'file',
        type: 'exclusive'
      });
      
      expect(result2.granted).toBe(false);
      expect(result2.waitingQueuePosition).toBe(1);
      
      await lockManager.releaseLock(result1.lockId!);
      
      assertLockStatus(lockManager, sharedFile, { locked: true, holder: agents[1].id });
      
      const locks = lockManager.getLocks({ file: sharedFile });
      expect(locks[0].waitingQueue.length).toBe(0);
    });

    it('should handle multiple files with partial overlaps', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      
      const result1 = await lockManager.acquireLock({
        agentId: agent1.id,
        taskId: 'T001',
        files: ['file1.ts', 'file2.ts'],
        granularity: 'file',
        type: 'exclusive'
      });
      expect(result1.granted).toBe(true);
      
      const result2 = await lockManager.acquireLock({
        agentId: agent2.id,
        taskId: 'T002',
        files: ['file2.ts', 'file3.ts'],
        granularity: 'file',
        type: 'exclusive'
      });
      expect(result2.granted).toBe(false);
      
      assertLockStatus(lockManager, 'file1.ts', { locked: true, holder: agent1.id });
      assertLockStatus(lockManager, 'file2.ts', { locked: true, holder: agent1.id });
      assertLockStatus(lockManager, 'file3.ts', { locked: false });
    });
  });

  describe('Independent Files Without Conflict', () => {
    it('should allow concurrent work on independent files', async () => {
      const agents = [TEST_AGENTS.successAgent, TEST_AGENTS.slowAgent, TEST_AGENTS.failingAgent];
      
      for (const agent of agents) {
        brain.addAgent(agent);
      }
      
      const results = await Promise.all([
        lockManager.acquireLock({
          agentId: agents[0].id,
          taskId: 'T001',
          files: ['src/module-a.ts'],
          granularity: 'file',
          type: 'exclusive'
        }),
        lockManager.acquireLock({
          agentId: agents[1].id,
          taskId: 'T002',
          files: ['src/module-b.ts'],
          granularity: 'file',
          type: 'exclusive'
        }),
        lockManager.acquireLock({
          agentId: agents[2].id,
          taskId: 'T003',
          files: ['src/module-c.ts'],
          granularity: 'file',
          type: 'exclusive'
        })
      ]);
      
      expect(results[0].granted).toBe(true);
      expect(results[1].granted).toBe(true);
      expect(results[2].granted).toBe(true);
      
      assertLockStatus(lockManager, 'src/module-a.ts', { locked: true, holder: agents[0].id });
      assertLockStatus(lockManager, 'src/module-b.ts', { locked: true, holder: agents[1].id });
      assertLockStatus(lockManager, 'src/module-c.ts', { locked: true, holder: agents[2].id });
    });

    it('should handle mixed shared and independent files', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      const sharedFile = 'src/shared/types.ts';
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      
      const result1 = await lockManager.acquireLock({
        agentId: agent1.id,
        taskId: 'T001',
        files: [sharedFile, 'src/feature-a.ts'],
        granularity: 'file',
        type: 'exclusive'
      });
      expect(result1.granted).toBe(true);
      
      const result2 = await lockManager.acquireLock({
        agentId: agent2.id,
        taskId: 'T002',
        files: ['src/feature-b.ts'],
        granularity: 'file',
        type: 'exclusive'
      });
      expect(result2.granted).toBe(true);
      
      const result3 = await lockManager.acquireLock({
        agentId: agent2.id,
        taskId: 'T003',
        files: [sharedFile],
        granularity: 'file',
        type: 'exclusive'
      });
      expect(result3.granted).toBe(false);
      expect(result3.waitingQueuePosition).toBe(1);
    });
  });

  describe('Concurrent Task Execution', () => {
    it('should execute multiple tasks concurrently on different files', async () => {
      const agents = [TEST_AGENTS.successAgent, TEST_AGENTS.slowAgent];
      
      for (const agent of agents) {
        brain.addAgent(agent);
      }
      
      brain.addTask({
        id: 'T001',
        title: 'Task A',
        description: 'Task A',
        type: 'task',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: ['src/a.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      });
      
      brain.addTask({
        id: 'T002',
        title: 'Task B',
        description: 'Task B',
        type: 'task',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: ['src/b.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      });
      
      const [lockResult1, lockResult2] = await Promise.all([
        lockManager.acquireLock({
          agentId: agents[0].id,
          taskId: 'T001',
          files: ['src/a.ts'],
          granularity: 'file',
          type: 'exclusive'
        }),
        lockManager.acquireLock({
          agentId: agents[1].id,
          taskId: 'T002',
          files: ['src/b.ts'],
          granularity: 'file',
          type: 'exclusive'
        })
      ]);
      
      expect(lockResult1.granted).toBe(true);
      expect(lockResult2.granted).toBe(true);
      
      brain.updateTaskStatus('T001', 'executing', agents[0].id);
      brain.updateTaskStatus('T002', 'executing', agents[1].id);
      
      expect(brain.getTask('T001')?.status).toBe('executing');
      expect(brain.getTask('T002')?.status).toBe('executing');
    });

    it('should serialize task execution for shared files', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      const sharedFile = 'src/shared.ts';
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      
      brain.addTask({
        id: 'T001',
        title: 'First Task',
        description: 'First',
        type: 'task',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: [sharedFile],
        children: [],
        dependencies: [],
        statusHistory: []
      });
      
      brain.addTask({
        id: 'T002',
        title: 'Second Task',
        description: 'Second',
        type: 'task',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: [sharedFile],
        children: [],
        dependencies: [],
        statusHistory: []
      });
      
      const lock1 = await lockManager.acquireLock({
        agentId: agent1.id,
        taskId: 'T001',
        files: [sharedFile],
        granularity: 'file',
        type: 'exclusive'
      });
      
      expect(lock1.granted).toBe(true);
      
      brain.updateTaskStatus('T001', 'executing', agent1.id);
      expect(brain.getTask('T001')?.status).toBe('executing');
      
      const lock2Promise = lockManager.acquireLock({
        agentId: agent2.id,
        taskId: 'T002',
        files: [sharedFile],
        granularity: 'file',
        type: 'exclusive'
      });
      
      const lock2 = await lock2Promise;
      expect(lock2.granted).toBe(false);
      expect(lock2.waitingQueuePosition).toBe(1);
      
      brain.updateTaskStatus('T002', 'blocked', 'orchestrator');
      expect(brain.getTask('T002')?.status).toBe('blocked');
    });
  });

  describe('Full Multi-Agent Workflow', () => {
    it('should complete full workflow with 3 agents', async () => {
      const agents = [TEST_AGENTS.successAgent, TEST_AGENTS.slowAgent, TEST_AGENTS.failingAgent];
      
      for (const agent of agents) {
        brain.addAgent(agent);
      }
      
      brain.addTask({
        id: 'MAIN',
        title: 'Main Task',
        description: 'Main collaborative task',
        type: 'milestone',
        status: 'pending',
        expectedOutput: { type: 'code', description: 'Complete', acceptanceCriteria: [] },
        estimatedFiles: [],
        children: ['T001', 'T002', 'T003'],
        dependencies: [],
        statusHistory: []
      });
      
      brain.addTask({
        id: 'T001',
        parentId: 'MAIN',
        title: 'Subtask 1',
        description: 'Independent work',
        type: 'task',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: ['src/module1.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      });
      
      brain.addTask({
        id: 'T002',
        parentId: 'MAIN',
        title: 'Subtask 2',
        description: 'Independent work',
        type: 'task',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: ['src/module2.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      });
      
      brain.addTask({
        id: 'T003',
        parentId: 'MAIN',
        title: 'Subtask 3',
        description: 'Independent work',
        type: 'task',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: ['src/module3.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      });
      
      const lockSkill = new LockManagementSkill(lockManager);
      
      const lockResults = await Promise.all([
        lockSkill.execute({
          action: 'acquire',
          agentId: agents[0].id,
          taskId: 'T001',
          files: ['src/module1.ts']
        }),
        lockSkill.execute({
          action: 'acquire',
          agentId: agents[1].id,
          taskId: 'T002',
          files: ['src/module2.ts']
        }),
        lockSkill.execute({
          action: 'acquire',
          agentId: agents[2].id,
          taskId: 'T003',
          files: ['src/module3.ts']
        })
      ]);
      
      expect(lockResults.every(r => r.success)).toBe(true);
      
      brain.updateTaskStatus('T001', 'executing', agents[0].id);
      brain.updateTaskStatus('T002', 'executing', agents[1].id);
      brain.updateTaskStatus('T003', 'executing', agents[2].id);
      
      for (const taskId of ['T001', 'T002', 'T003']) {
        brain.updateTaskStatus(taskId, 'reviewing', agents.find(a => a.id === brain.getTask(taskId)?.statusHistory.slice(-1)[0].changedBy)!.id);
        brain.updateTaskStatus(taskId, 'completed', 'reviewer');
      }
      
      brain.updateTaskStatus('MAIN', 'completed', 'orchestrator');
      
      await lockSkill.execute({ action: 'release_all', agentId: agents[0].id });
      await lockSkill.execute({ action: 'release_all', agentId: agents[1].id });
      await lockSkill.execute({ action: 'release_all', agentId: agents[2].id });
      
      await brain.save();
      
      const brain2 = new ProjectBrainImpl(project.dir);
      await brain2.load();
      
      expect(brain2.tasks.nodes.size).toBe(4);
      expect(brain2.getTask('MAIN')?.status).toBe('completed');
      expect(brain2.getTask('T001')?.status).toBe('completed');
      expect(brain2.getTask('T002')?.status).toBe('completed');
      expect(brain2.getTask('T003')?.status).toBe('completed');
    });
  });
});