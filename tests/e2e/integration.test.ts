import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Core imports
import { ProjectBrainImpl } from '@agent-orchestrator/core/brain/brain';
import { LockManager } from '@agent-orchestrator/core/lock/manager';
import { ConflictDetector } from '@agent-orchestrator/core/conflict/detector';
import { RegionConflictDetector } from '@agent-orchestrator/core/conflict/region-detector';
import { SemanticConflictDetector } from '@agent-orchestrator/core/conflict/semantic-detector';
import { TaskStateMachine, canTransition } from '@agent-orchestrator/core/task/state-machine';
import { createLogger, getGlobalLogs, clearGlobalLogs } from '@agent-orchestrator/core/logging/logger';

// Orchestrator imports
import { TaskDecompositionSkill } from '@agent-orchestrator/orchestrator/skills/task-decomposition';
import { AgentDispatchSkill } from '@agent-orchestrator/orchestrator/skills/agent-dispatch';
import { LockManagementSkill } from '@agent-orchestrator/orchestrator/skills/lock-management';
import { TaskReviewSkill } from '@agent-orchestrator/orchestrator/skills/task-review';
import { DecisionLogSkill } from '@agent-orchestrator/orchestrator/skills/decision-log';

// Adapter imports
import { CliAdapter } from '@agent-orchestrator/adapter/cli-adapter';
import { generateLockProtocolPrompt } from '@agent-orchestrator/adapter/prompts/lock-protocol';

describe('End-to-End Integration Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-orch-e2e-'));
    clearGlobalLogs();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Project Brain Lifecycle', () => {
    it('should create, save, load, and modify brain', async () => {
      const brain = new ProjectBrainImpl(tempDir, {
        name: 'E2E Test Project',
        version: '1.0.0',
        goal: {
          description: 'Test end-to-end functionality',
          successCriteria: ['All tests pass'],
          constraints: ['No external dependencies']
        }
      });

      // Add agents
      brain.addAgent({
        id: 'agent-1',
        name: 'Test Agent',
        description: 'Test agent for E2E',
        skills: [{ id: 'test', name: 'Testing', tags: ['test'] }],
        workingDirectory: tempDir,
        status: 'online'
      });

      // Add tasks
      brain.addTask({
        id: 'T001',
        title: 'Test Task',
        description: 'A test task',
        type: 'task',
        status: 'pending',
        expectedOutput: {
          type: 'code',
          description: 'Test output',
          acceptanceCriteria: ['Works correctly']
        },
        estimatedFiles: ['test.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      });

      // Save
      await brain.save();

      // Load in new instance
      const brain2 = new ProjectBrainImpl(tempDir);
      const loaded = await brain2.load();

      expect(loaded).toBe(true);
      expect(brain2.name).toBe('E2E Test Project');
      expect(brain2.agents.length).toBe(1);
      expect(brain2.agents[0].name).toBe('Test Agent');
      expect(brain2.tasks.nodes.size).toBe(1);
    });

    it('should update task status with history', async () => {
      const brain = new ProjectBrainImpl(tempDir);
      
      brain.addTask({
        id: 'T001',
        title: 'Test',
        description: 'Test',
        type: 'task',
        status: 'pending',
        expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
        estimatedFiles: [],
        children: [],
        dependencies: [],
        statusHistory: []
      });

      brain.updateTaskStatus('T001', 'executing', 'test-runner');

      const task = brain.getTask('T001');
      expect(task?.status).toBe('executing');
      expect(task?.statusHistory.length).toBe(1);
    });
  });

  describe('Lock Manager Integration', () => {
    it('should acquire, check, and release locks', async () => {
      const lockManager = new LockManager();

      // Acquire lock
      const result1 = await lockManager.acquireLock({
        agentId: 'agent-1',
        taskId: 'T001',
        files: ['file1.ts', 'file2.ts'],
        granularity: 'file',
        type: 'exclusive'
      });

      expect(result1.granted).toBe(true);

      // Check lock status
      const status = lockManager.getLockStatus('file1.ts');
      expect(status.locked).toBe(true);
      expect(status.holder).toBe('agent-1');

      // Try to acquire same file with different agent
      const result2 = await lockManager.acquireLock({
        agentId: 'agent-2',
        taskId: 'T002',
        files: ['file1.ts'],
        granularity: 'file',
        type: 'exclusive'
      });

      expect(result2.granted).toBe(false);
      expect(result2.waitingQueuePosition).toBe(1);

      // Release lock
      await lockManager.releaseLock(result1.lockId!);

      // Verify release and queue processing
      const statusAfter = lockManager.getLockStatus('file1.ts');
      expect(statusAfter.locked).toBe(true);
      expect(statusAfter.holder).toBe('agent-2');
    });
  });

  describe('Conflict Detection Integration', () => {
    it('should detect conflicts at all three layers', async () => {
      const lockManager = new LockManager();
      const pathDetector = new ConflictDetector(lockManager);
      const regionDetector = new RegionConflictDetector();
      const semanticDetector = new SemanticConflictDetector();

      // Acquire a lock
      await lockManager.acquireLock({
        agentId: 'agent-1',
        taskId: 'T001',
        files: ['file1.ts'],
        granularity: 'file',
        type: 'exclusive'
      });

      // Layer 1: Path conflict
      const pathReport = await pathDetector.detectConflicts([
        { file: 'file1.ts', type: 'modify', agentId: 'agent-2', description: 'Test' }
      ]);
      expect(pathReport.hasConflicts).toBe(true);

      // Layer 2: Region conflict
      const regionReport = regionDetector.detectRegionConflicts([
        {
          file: 'file2.ts',
          type: 'modify',
          agentId: 'agent-1',
          description: 'Test',
          regions: [{ startLine: 10, endLine: 20 }]
        },
        {
          file: 'file2.ts',
          type: 'modify',
          agentId: 'agent-2',
          description: 'Test',
          regions: [{ startLine: 15, endLine: 25 }]
        }
      ]);
      expect(regionReport.hasConflicts).toBe(true);

      // Layer 3: Semantic conflict - need multiple agents for conflict
      const semanticReport = await semanticDetector.detectSemanticConflicts(
        [
          {
            file: 'api.ts',
            type: 'modify',
            agentId: 'agent-1',
            description: 'Changed API',
            regions: [{ startLine: 1, endLine: 10 }]
          },
          {
            file: 'other.ts',
            type: 'modify',
            agentId: 'agent-2',
            description: 'Other change',
            regions: [{ startLine: 1, endLine: 10 }]
          }
        ],
        {
          background: 'API module',
          codeSnippets: new Map([
            ['api.ts', {
              file: 'api.ts',
              language: 'typescript',
              content: 'export function getData(): Promise<Data>',
              description: 'API endpoint'
            }]
          ]),
          outputs: new Map(),
          pendingQuestions: [],
          recentFileChanges: new Map()
        }
      );
      // Semantic conflicts require multiple agents working on related files
      expect(semanticReport.conflicts.some(c => c.type === 'api_breaking_change')).toBe(true);
    });
  });

  describe('Task State Machine Integration', () => {
    it('should enforce valid state transitions', () => {
      const machine = new TaskStateMachine('pending');

      // Valid transitions
      expect(machine.transition('ready', 'dependencies met')).toBe(true);
      expect(machine.current).toBe('ready');

      expect(machine.transition('assigned', 'agent assigned')).toBe(true);
      expect(machine.current).toBe('assigned');

      expect(machine.transition('executing', 'agent started')).toBe(true);
      expect(machine.current).toBe('executing');

      expect(machine.transition('reviewing', 'work completed')).toBe(true);
      expect(machine.current).toBe('reviewing');

      expect(machine.transition('completed', 'approved')).toBe(true);
      expect(machine.current).toBe('completed');

      // Invalid transition from completed
      expect(machine.canTransitionTo('executing')).toBe(false);
    });

    it('should record full history', () => {
      const machine = new TaskStateMachine('pending');
      machine.transition('ready', 'test 1');
      machine.transition('assigned', 'test 2');

      const history = machine.getHistory();
      expect(history.length).toBe(2);
      expect(history[0].from).toBe('pending');
      expect(history[0].to).toBe('ready');
    });
  });

  describe('Skills Integration', () => {
    it('should decompose, dispatch, and review tasks', async () => {
      const lockManager = new LockManager();
      const logger = createLogger('e2e-test');

      // 1. Task Decomposition
      const decompositionSkill = new TaskDecompositionSkill();
      const decomposition = await decompositionSkill.execute({
        taskDescription: '将 CardTableViewCell 迁移到 SwiftUI',
        goal: '完成迁移',
        constraints: ['保持兼容'],
        availableAgents: [
          {
            id: 'qoder',
            name: 'Qoder',
            description: 'Native expert',
            skills: [{ id: 'analyze', name: '分析', tags: ['objc'] }],
            workingDirectory: tempDir,
            status: 'online'
          }
        ]
      });

      expect(decomposition.subtasks.length).toBeGreaterThan(0);
      logger.info('Task decomposed', { subtaskCount: decomposition.subtasks.length });

      // 2. Agent Dispatch
      const adapter = new CliAdapter({
        name: 'test-agent',
        command: 'echo',
        args: ['task completed'],
        cwd: tempDir
      });

      const dispatchSkill = new AgentDispatchSkill(lockManager, { 'test-agent': adapter });
      const dispatchResult = await dispatchSkill.execute({
        agentId: 'test-agent',
        task: {
          id: 'T001',
          title: 'Test',
          description: 'Test',
          type: 'task',
          status: 'pending',
          expectedOutput: { type: 'code', description: '', acceptanceCriteria: [] },
          estimatedFiles: ['test.ts'],
          children: [],
          dependencies: [],
          statusHistory: []
        },
        context: {
          projectGoal: 'Test',
          agentRole: 'tester',
          relevantCodeSnippets: [],
          relatedOutputs: [],
          currentLocks: []
        }
      });

      expect(dispatchResult.status).toBe('completed');
      logger.info('Task dispatched', { status: dispatchResult.status });

      // 3. Task Review
      const reviewSkill = new TaskReviewSkill();
      const review = await reviewSkill.execute({
        task: {
          id: 'T001',
          title: 'Test',
          description: 'Test',
          type: 'task',
          status: 'reviewing',
          expectedOutput: {
            type: 'code',
            description: 'Output',
            acceptanceCriteria: ['test']
          },
          estimatedFiles: [],
          children: [],
          dependencies: [],
          statusHistory: []
        },
        output: {
          summary: 'Task completed with test',
          files: ['test.ts'],
          artifacts: []
        },
        reviewType: 'both'
      });

      expect(review.passed).toBeDefined();
      logger.info('Task reviewed', { passed: review.passed });

      // 4. Check logs
      const logs = logger.getLogs();
      expect(logs.length).toBe(3);
    });

    it('should manage locks via skill', async () => {
      const lockManager = new LockManager();
      const lockSkill = new LockManagementSkill(lockManager);

      // Acquire
      const acquire = await lockSkill.execute({
        action: 'acquire',
        agentId: 'agent-1',
        taskId: 'T001',
        files: ['file1.ts']
      });
      expect(acquire.success).toBe(true);

      // List
      const list = await lockSkill.execute({ action: 'list' });
      expect(list.locks?.length).toBe(1);

      // Release
      const release = await lockSkill.execute({
        action: 'release',
        agentId: 'agent-1',
        files: ['file1.ts']
      });
      expect(release.success).toBe(true);
    });

    it('should log and query decisions', async () => {
      const decisionSkill = new DecisionLogSkill();

      // Record decisions
      await decisionSkill.execute({
        action: 'record',
        decision: {
          decision: 'Use TypeScript',
          decider: 'human',
          context: 'Tech stack selection',
          alternatives: ['JavaScript'],
          impact: ['Better type safety']
        }
      });

      await decisionSkill.execute({
        action: 'record',
        decision: {
          decision: 'Use React',
          decider: 'agent-1',
          context: 'UI framework',
          alternatives: ['Vue'],
          impact: ['Component reuse']
        }
      });

      // List all
      const all = await decisionSkill.execute({ action: 'list' });
      expect(all.decisions?.length).toBe(2);

      // Filter by decider
      const human = await decisionSkill.execute({
        action: 'list',
        filters: { decider: 'human' }
      });
      expect(human.decisions?.length).toBe(1);
      expect(human.decisions?.[0].decision).toBe('Use TypeScript');
    });
  });

  describe('Lock Protocol Prompts', () => {
    it('should generate valid lock protocol prompts', () => {
      const prompt = generateLockProtocolPrompt({
        locks: [
          { file: 'file1.ts', holder: 'agent-1', status: 'active' }
        ],
        task: {
          title: 'Test Task',
          description: 'Test description'
        }
      });

      expect(prompt).toContain('file1.ts');
      expect(prompt).toContain('agent-1');
      expect(prompt).toContain('[DECLARE]');
      expect(prompt).toContain('[RELEASE]');
      expect(prompt).toContain('Test Task');
    });
  });

  describe('Logging Integration', () => {
    it('should log from multiple sources and filter', () => {
      const logger1 = createLogger('module-1');
      const logger2 = createLogger('module-2');

      logger1.info('Info from module 1', { agentId: 'agent-1' });
      logger2.error('Error from module 2', { agentId: 'agent-2' });
      logger1.warn('Warning from module 1', { taskId: 'T001' });

      // Filter by level
      const errors = getGlobalLogs({ level: 'error' });
      expect(errors.length).toBe(1);

      // Filter by agent
      const agentLogs = getGlobalLogs({ agentId: 'agent-1' });
      expect(agentLogs.length).toBe(1);

      // Filter by task
      const taskLogs = getGlobalLogs({ taskId: 'T001' });
      expect(taskLogs.length).toBe(1);
    });
  });

  describe('Full Workflow Simulation', () => {
    it('should complete a full task lifecycle', async () => {
      const brain = new ProjectBrainImpl(tempDir, {
        name: 'Full Workflow Test',
        goal: { description: 'Test complete workflow', successCriteria: [], constraints: [] }
      });
      const lockManager = new LockManager();
      const logger = createLogger('workflow');

      // 1. Initialize project
      logger.info('Project initialized');

      // 2. Register agents
      brain.addAgent({
        id: 'agent-1',
        name: 'Developer',
        description: 'Code agent',
        skills: [{ id: 'code', name: 'Coding', tags: ['code'] }],
        workingDirectory: tempDir,
        status: 'online'
      });

      // 3. Create task
      brain.addTask({
        id: 'T001',
        title: 'Implement Feature',
        description: 'Implement new feature',
        type: 'task',
        status: 'pending',
        expectedOutput: {
          type: 'code',
          description: 'Feature implementation',
          acceptanceCriteria: ['Works', 'Tested']
        },
        estimatedFiles: ['feature.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      });

      // 4. Decompose task
      const decomposition = new TaskDecompositionSkill();
      const result = await decomposition.execute({
        taskDescription: 'Implement Feature',
        goal: 'Complete feature',
        constraints: [],
        availableAgents: brain.agents
      });
      logger.info('Task decomposed', { subtasks: result.subtasks.length });

      // 5. Acquire locks
      const lockResult = await lockManager.acquireLock({
        agentId: 'agent-1',
        taskId: 'T001',
        files: ['feature.ts'],
        granularity: 'file',
        type: 'exclusive'
      });
      expect(lockResult.granted).toBe(true);
      logger.info('Locks acquired');

      // 6. Update task status
      brain.updateTaskStatus('T001', 'executing', 'orchestrator');

      // 7. Simulate completion
      brain.updateTaskStatus('T001', 'reviewing', 'agent-1');

      // 8. Review task
      const reviewSkill = new TaskReviewSkill();
      const review = await reviewSkill.execute({
        task: brain.getTask('T001')!,
        output: {
          summary: 'Feature implemented with Works and Tested',
          files: ['feature.ts'],
          artifacts: []
        },
        reviewType: 'both'
      });

      // 9. Complete task
      if (review.passed) {
        brain.updateTaskStatus('T001', 'completed', 'reviewer');
      }

      // 10. Release locks
      await lockManager.releaseLock(lockResult.lockId!);

      // 11. Save brain
      await brain.save();

      // Verify final state
      const finalTask = brain.getTask('T001');
      expect(finalTask?.status).toBe('completed');
      expect(finalTask?.statusHistory.length).toBe(3);

      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThan(0);

      logger.info('Workflow completed successfully');
    });
  });

  describe('State Persistence (L1-05)', () => {
    it('should persist all brain data correctly after save/load cycle', async () => {
      const brain = new ProjectBrainImpl(tempDir, {
        name: 'Persistence Test',
        version: '2.0.0',
        goal: {
          description: 'Test persistence',
          successCriteria: ['Criteria 1', 'Criteria 2'],
          constraints: ['Constraint 1']
        }
      });

      brain.addAgent({
        id: 'persist-agent',
        name: 'Persist Agent',
        description: 'Test agent',
        skills: [{ id: 'test', name: 'Test', tags: ['test'] }],
        workingDirectory: tempDir,
        status: 'online'
      });

      brain.addTask({
        id: 'PERSIST-001',
        title: 'Persist Task',
        description: 'Task to test persistence',
        type: 'task',
        status: 'pending',
        expectedOutput: {
          type: 'code',
          description: 'Output',
          acceptanceCriteria: ['AC1', 'AC2']
        },
        estimatedFiles: ['persist.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      });

      brain.context.background = 'Test background info';
      brain.decisions.push({
        id: 'decision-1',
        decision: 'Use TypeScript',
        decider: 'human',
        context: 'Initial setup',
        alternatives: ['JavaScript'],
        impact: ['Type safety'],
        timestamp: new Date(),
        relatedTasks: [],
        relatedFiles: []
      });

      await brain.save();

      const brain2 = new ProjectBrainImpl(tempDir);
      const loaded = await brain2.load();

      expect(loaded).toBe(true);
      expect(brain2.name).toBe('Persistence Test');
      expect(brain2.version).toBe('2.0.0');
      expect(brain2.goal.description).toBe('Test persistence');
      expect(brain2.goal.successCriteria).toEqual(['Criteria 1', 'Criteria 2']);
      expect(brain2.goal.constraints).toEqual(['Constraint 1']);
      expect(brain2.agents.length).toBe(1);
      expect(brain2.agents[0].id).toBe('persist-agent');
      expect(brain2.tasks.nodes.size).toBe(1);
      const task = brain2.getTask('PERSIST-001');
      expect(task?.title).toBe('Persist Task');
      expect(brain2.context.background).toBe('Test background info');
      expect(brain2.decisions.length).toBe(1);
      expect(brain2.decisions[0].decision).toBe('Use TypeScript');
    });
  });

  describe('Error Handling (L1-06)', () => {
    it('should handle invalid task status transitions', () => {
      const machine = new TaskStateMachine('completed');
      expect(machine.canTransitionTo('pending')).toBe(false);
    });

    it('should update existing agent on duplicate registration', () => {
      const brain = new ProjectBrainImpl(tempDir);
      
      brain.addAgent({
        id: 'dup-agent',
        name: 'Dup Agent',
        description: 'Test',
        skills: [],
        workingDirectory: tempDir,
        status: 'online'
      });

      brain.addAgent({
        id: 'dup-agent',
        name: 'Dup Agent 2',
        description: 'Test 2',
        skills: [],
        workingDirectory: tempDir,
        status: 'online'
      });

      expect(brain.agents.length).toBe(1);
      expect(brain.agents[0].name).toBe('Dup Agent 2');
    });

    it('should handle non-existent task retrieval', () => {
      const brain = new ProjectBrainImpl(tempDir);
      const task = brain.getTask('non-existent');
      expect(task).toBeUndefined();
    });

    it('should handle lock release of non-existent lock gracefully', async () => {
      const lockManager = new LockManager();
      await expect(lockManager.releaseLock('non-existent-lock')).resolves.toBeUndefined();
    });
  });
});