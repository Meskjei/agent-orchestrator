import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectBrainImpl } from '@agent-orchestrator/core/brain/brain';
import { LockManager } from '@agent-orchestrator/core/lock/manager';
import { ConflictDetector } from '@agent-orchestrator/core/conflict/detector';
import { RegionConflictDetector } from '@agent-orchestrator/core/conflict/region-detector';
import { SemanticConflictDetector } from '@agent-orchestrator/core/conflict/semantic-detector';
import { createTempProject, cleanupTempProject, createTestBrain } from '../helpers/fixture';
import { TEST_AGENTS } from '../helpers/test-agents';
import { TempProject } from '../helpers/fixture';
import { FileChange, SharedContext } from '@agent-orchestrator/core/types';

describe('Layer 4: Conflict Detection', () => {
  let project: TempProject;
  let brain: ProjectBrainImpl;
  let lockManager: LockManager;
  let pathDetector: ConflictDetector;
  let regionDetector: RegionConflictDetector;
  let semanticDetector: SemanticConflictDetector;

  beforeEach(async () => {
    project = await createTempProject('conflict-detection');
    brain = await createTestBrain(project.dir, {
      name: 'Conflict Detection Test',
      goal: 'Test conflict detection at all layers'
    });
    lockManager = new LockManager();
    pathDetector = new ConflictDetector(lockManager);
    regionDetector = new RegionConflictDetector();
    semanticDetector = new SemanticConflictDetector();
  });

  afterEach(async () => {
    await cleanupTempProject(project);
  });

  describe('Layer 1: Path Conflicts', () => {
    it('should detect conflict when same file is locked by another agent', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      const conflictFile = 'src/shared/service.ts';
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      
      await lockManager.acquireLock({
        agentId: agent1.id,
        taskId: 'T001',
        files: [conflictFile],
        granularity: 'file',
        type: 'exclusive'
      });
      
      const plannedChanges: FileChange[] = [
        {
          file: conflictFile,
          type: 'modify',
          description: 'Update service logic',
          agentId: agent2.id
        }
      ];
      
      const report = await pathDetector.detectConflicts(plannedChanges);
      
      expect(report.hasConflicts).toBe(true);
      expect(report.pathConflicts.length).toBe(1);
      expect(report.pathConflicts[0].file).toBe(conflictFile);
      expect(report.pathConflicts[0].lockedBy.agentId).toBe(agent1.id);
      expect(report.pathConflicts[0].requestedBy).toBe(agent2.id);
    });

    it('should not report conflict for same agent', async () => {
      const agent = TEST_AGENTS.successAgent;
      brain.addAgent(agent);
      
      await lockManager.acquireLock({
        agentId: agent.id,
        taskId: 'T001',
        files: ['src/file.ts'],
        granularity: 'file',
        type: 'exclusive'
      });
      
      const plannedChanges: FileChange[] = [
        {
          file: 'src/file.ts',
          type: 'modify',
          description: 'Continue work',
          agentId: agent.id
        }
      ];
      
      const report = await pathDetector.detectConflicts(plannedChanges);
      
      expect(report.hasConflicts).toBe(false);
      expect(report.pathConflicts.length).toBe(0);
    });

    it('should detect multiple path conflicts', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      
      await lockManager.acquireLock({
        agentId: agent1.id,
        taskId: 'T001',
        files: ['src/file1.ts', 'src/file2.ts'],
        granularity: 'file',
        type: 'exclusive'
      });
      
      const plannedChanges: FileChange[] = [
        {
          file: 'src/file1.ts',
          type: 'modify',
          description: 'Change 1',
          agentId: agent2.id
        },
        {
          file: 'src/file2.ts',
          type: 'modify',
          description: 'Change 2',
          agentId: agent2.id
        },
        {
          file: 'src/file3.ts',
          type: 'modify',
          description: 'Change 3',
          agentId: agent2.id
        }
      ];
      
      const report = await pathDetector.detectConflicts(plannedChanges);
      
      expect(report.hasConflicts).toBe(true);
      expect(report.pathConflicts.length).toBe(2);
      expect(report.recommendations.length).toBe(2);
    });

    it('should provide recommendations for conflict resolution', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      
      await lockManager.acquireLock({
        agentId: agent1.id,
        taskId: 'T001',
        files: ['src/api.ts'],
        granularity: 'file',
        type: 'exclusive'
      });
      
      const plannedChanges: FileChange[] = [
        {
          file: 'src/api.ts',
          type: 'modify',
          description: 'Update API',
          agentId: agent2.id
        }
      ];
      
      const report = await pathDetector.detectConflicts(plannedChanges);
      
      expect(report.recommendations.length).toBe(1);
      expect(report.recommendations[0]).toContain('src/api.ts');
      expect(report.recommendations[0]).toContain(agent1.id);
      expect(report.recommendations[0]).toContain('Wait for release');
    });
  });

  describe('Layer 2: Region Conflicts', () => {
    it('should detect overlapping line ranges', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      
      const changes: FileChange[] = [
        {
          file: 'src/service.ts',
          type: 'modify',
          description: 'Update function A',
          agentId: agent1.id,
          regions: [{ startLine: 10, endLine: 20 }]
        },
        {
          file: 'src/service.ts',
          type: 'modify',
          description: 'Update function B',
          agentId: agent2.id,
          regions: [{ startLine: 15, endLine: 25 }]
        }
      ];
      
      const report = regionDetector.detectRegionConflicts(changes);
      
      expect(report.hasConflicts).toBe(true);
      expect(report.conflicts.length).toBe(1);
      expect(report.conflicts[0].file).toBe('src/service.ts');
      expect(report.conflicts[0].agent1).toBe(agent1.id);
      expect(report.conflicts[0].agent2).toBe(agent2.id);
    });

    it('should not detect conflict for non-overlapping regions', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      
      const changes: FileChange[] = [
        {
          file: 'src/service.ts',
          type: 'modify',
          description: 'Update top section',
          agentId: agent1.id,
          regions: [{ startLine: 1, endLine: 50 }]
        },
        {
          file: 'src/service.ts',
          type: 'modify',
          description: 'Update bottom section',
          agentId: agent2.id,
          regions: [{ startLine: 51, endLine: 100 }]
        }
      ];
      
      const report = regionDetector.detectRegionConflicts(changes);
      
      expect(report.hasConflicts).toBe(false);
      expect(report.conflicts.length).toBe(0);
    });

    it('should detect complex overlapping patterns', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      const agent3 = TEST_AGENTS.failingAgent;
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      brain.addAgent(agent3);
      
      const changes: FileChange[] = [
        {
          file: 'src/complex.ts',
          type: 'modify',
          description: 'Agent 1 changes',
          agentId: agent1.id,
          regions: [
            { startLine: 10, endLine: 20 },
            { startLine: 50, endLine: 60 }
          ]
        },
        {
          file: 'src/complex.ts',
          type: 'modify',
          description: 'Agent 2 changes',
          agentId: agent2.id,
          regions: [{ startLine: 15, endLine: 25 }]
        },
        {
          file: 'src/complex.ts',
          type: 'modify',
          description: 'Agent 3 changes',
          agentId: agent3.id,
          regions: [{ startLine: 55, endLine: 65 }]
        }
      ];
      
      const report = regionDetector.detectRegionConflicts(changes);
      
      expect(report.hasConflicts).toBe(true);
      expect(report.conflicts.length).toBe(2);
    });

    it('should handle exact same region conflict', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      
      const changes: FileChange[] = [
        {
          file: 'src/same-region.ts',
          type: 'modify',
          description: 'Agent 1 modification',
          agentId: agent1.id,
          regions: [{ startLine: 10, endLine: 20 }]
        },
        {
          file: 'src/same-region.ts',
          type: 'modify',
          description: 'Agent 2 modification',
          agentId: agent2.id,
          regions: [{ startLine: 10, endLine: 20 }]
        }
      ];
      
      const report = regionDetector.detectRegionConflicts(changes);
      
      expect(report.hasConflicts).toBe(true);
      expect(report.conflicts[0].region1.startLine).toBe(10);
      expect(report.conflicts[0].region2.startLine).toBe(10);
    });

    it('should skip same agent regions', async () => {
      const agent = TEST_AGENTS.successAgent;
      brain.addAgent(agent);
      
      const changes: FileChange[] = [
        {
          file: 'src/single-agent.ts',
          type: 'modify',
          description: 'First change',
          agentId: agent.id,
          regions: [{ startLine: 10, endLine: 20 }]
        },
        {
          file: 'src/single-agent.ts',
          type: 'modify',
          description: 'Second change',
          agentId: agent.id,
          regions: [{ startLine: 15, endLine: 25 }]
        }
      ];
      
      const report = regionDetector.detectRegionConflicts(changes);
      
      expect(report.hasConflicts).toBe(false);
    });
  });

  describe('Layer 3: Semantic Conflicts', () => {
    it('should detect API breaking changes', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      
      const context: SharedContext = {
        background: 'API module',
        codeSnippets: new Map([
          ['src/api.ts', {
            file: 'src/api.ts',
            language: 'typescript',
            content: 'export function getData(): Promise<Data> {\n  return fetch("/api/data");\n}',
            description: 'API endpoint'
          }]
        ]),
        outputs: new Map(),
        pendingQuestions: [],
        recentFileChanges: new Map()
      };
      
      const plannedChanges: FileChange[] = [
        {
          file: 'src/api.ts',
          type: 'modify',
          description: 'Change API signature',
          agentId: agent1.id,
          regions: [{ startLine: 1, endLine: 5 }]
        },
        {
          file: 'src/other.ts',
          type: 'modify',
          description: 'Other work',
          agentId: agent2.id,
          regions: [{ startLine: 1, endLine: 10 }]
        }
      ];
      
      const report = await semanticDetector.detectSemanticConflicts(plannedChanges, context);
      
      expect(report.hasConflicts).toBe(true);
      expect(report.conflicts.some((c: any) => c.type === 'api_breaking_change')).toBe(true);
      
      const apiConflict = report.conflicts.find((c: any) => c.type === 'api_breaking_change');
      expect(apiConflict?.severity).toBe('high');
      expect(apiConflict?.affectedAgents).toContain(agent2.id);
    });

    it('should detect interface mismatches', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      
      const context: SharedContext = {
        background: 'Type definitions',
        codeSnippets: new Map([
          ['src/types.ts', {
            file: 'src/types.ts',
            language: 'typescript',
            content: 'export interface User {\n  id: string;\n  name: string;\n}',
            description: 'User type definition'
          }]
        ]),
        outputs: new Map(),
        pendingQuestions: [],
        recentFileChanges: new Map()
      };
      
      const plannedChanges: FileChange[] = [
        {
          file: 'src/types.ts',
          type: 'modify',
          description: 'Update User interface',
          agentId: agent1.id,
          regions: [{ startLine: 1, endLine: 5 }]
        },
        {
          file: 'src/user-service.ts',
          type: 'modify',
          description: 'Update user service',
          agentId: agent2.id,
          regions: [{ startLine: 1, endLine: 10 }]
        }
      ];
      
      const report = await semanticDetector.detectSemanticConflicts(plannedChanges, context);
      
      expect(report.hasConflicts).toBe(true);
      expect(report.conflicts.some((c: any) => c.type === 'interface_mismatch')).toBe(true);
    });

    it('should detect dependency changes', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      
      const context: SharedContext = {
        background: 'Shared module',
        codeSnippets: new Map(),
        outputs: new Map(),
        pendingQuestions: [],
        recentFileChanges: new Map()
      };
      
      const plannedChanges: FileChange[] = [
        {
          file: 'src/utils/helper.ts',
          type: 'modify',
          description: 'Update helper',
          agentId: agent1.id
        },
        {
          file: 'src/utils/format.ts',
          type: 'modify',
          description: 'Update format',
          agentId: agent2.id
        }
      ];
      
      const report = await semanticDetector.detectSemanticConflicts(plannedChanges, context);
      
      expect(report.hasConflicts).toBe(true);
      expect(report.conflicts.some((c: any) => c.type === 'dependency_change')).toBe(true);
    });

    it('should detect data format changes', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      
      const context: SharedContext = {
        background: 'Data layer',
        codeSnippets: new Map([
          ['src/schema.json', {
            file: 'src/schema.json',
            language: 'json',
            content: '{ "type": "object", "properties": { "id": { "type": "string" } } }',
            description: 'Data schema'
          }]
        ]),
        outputs: new Map(),
        pendingQuestions: [],
        recentFileChanges: new Map()
      };
      
      const plannedChanges: FileChange[] = [
        {
          file: 'src/schema.json',
          type: 'modify',
          description: 'Update schema',
          agentId: agent1.id
        },
        {
          file: 'src/data-service.ts',
          type: 'modify',
          description: 'Update data service',
          agentId: agent2.id
        }
      ];
      
      const report = await semanticDetector.detectSemanticConflicts(plannedChanges, context);
      
      expect(report.hasConflicts).toBe(true);
      expect(report.conflicts.some((c: any) => c.type === 'data_format_change')).toBe(true);
    });

    it('should provide appropriate suggestions for each conflict type', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      
      const context: SharedContext = {
        background: 'API module',
        codeSnippets: new Map([
          ['src/api.ts', {
            file: 'src/api.ts',
            language: 'typescript',
            content: 'export function getData(): Promise<Data>',
            description: 'API endpoint'
          }]
        ]),
        outputs: new Map(),
        pendingQuestions: [],
        recentFileChanges: new Map()
      };
      
      const plannedChanges: FileChange[] = [
        {
          file: 'src/api.ts',
          type: 'modify',
          description: 'Change API',
          agentId: agent1.id
        },
        {
          file: 'src/other.ts',
          type: 'modify',
          description: 'Other work',
          agentId: agent2.id
        }
      ];
      
      const report = await semanticDetector.detectSemanticConflicts(plannedChanges, context);
      
      const conflict = report.conflicts.find((c: any) => c.type === 'api_breaking_change');
      expect(conflict).toBeDefined();
      expect(conflict?.suggestion).toBeDefined();
      expect(conflict?.suggestion.length).toBeGreaterThan(10);
    });
  });

  describe('All-Layer Conflict Integration', () => {
    it('should detect conflicts at all 3 layers simultaneously', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      
      await lockManager.acquireLock({
        agentId: agent1.id,
        taskId: 'T001',
        files: ['src/api.ts'],
        granularity: 'file',
        type: 'exclusive'
      });
      
      const context: SharedContext = {
        background: 'API module',
        codeSnippets: new Map([
          ['src/api.ts', {
            file: 'src/api.ts',
            language: 'typescript',
            content: 'export function getData(): Promise<Data>',
            description: 'API endpoint'
          }]
        ]),
        outputs: new Map(),
        pendingQuestions: [],
        recentFileChanges: new Map()
      };
      
      const plannedChanges: FileChange[] = [
        {
          file: 'src/api.ts',
          type: 'modify',
          description: 'Agent 2 API change',
          agentId: agent2.id,
          regions: [{ startLine: 1, endLine: 10 }]
        }
      ];
      
      const pathReport = await pathDetector.detectConflicts(plannedChanges);
      expect(pathReport.hasConflicts).toBe(true);
      
      const regionChanges: FileChange[] = [
        {
          file: 'src/service.ts',
          type: 'modify',
          description: 'Agent 1 service',
          agentId: agent1.id,
          regions: [{ startLine: 10, endLine: 20 }]
        },
        {
          file: 'src/service.ts',
          type: 'modify',
          description: 'Agent 2 service',
          agentId: agent2.id,
          regions: [{ startLine: 15, endLine: 25 }]
        }
      ];
      const regionReport = regionDetector.detectRegionConflicts(regionChanges);
      expect(regionReport.hasConflicts).toBe(true);
      
      const semanticChanges: FileChange[] = [
        {
          file: 'src/api.ts',
          type: 'modify',
          description: 'Agent 1 modifies API',
          agentId: agent1.id
        },
        {
          file: 'src/consumer.ts',
          type: 'modify',
          description: 'Agent 2 uses API',
          agentId: agent2.id
        }
      ];
      const semanticReport = await semanticDetector.detectSemanticConflicts(semanticChanges, context);
      expect(semanticReport.hasConflicts).toBe(true);
    });

    it('should handle no-conflict scenario correctly', async () => {
      const agent1 = TEST_AGENTS.successAgent;
      const agent2 = TEST_AGENTS.slowAgent;
      
      brain.addAgent(agent1);
      brain.addAgent(agent2);
      
      const plannedChanges: FileChange[] = [
        {
          file: 'features/auth/module-a.ts',
          type: 'modify',
          description: 'Agent 1 work',
          agentId: agent1.id,
          regions: [{ startLine: 1, endLine: 50 }]
        },
        {
          file: 'features/billing/module-b.ts',
          type: 'modify',
          description: 'Agent 2 work',
          agentId: agent2.id,
          regions: [{ startLine: 1, endLine: 50 }]
        }
      ];
      
      const pathReport = await pathDetector.detectConflicts(plannedChanges);
      expect(pathReport.hasConflicts).toBe(false);
      
      const regionReport = regionDetector.detectRegionConflicts(plannedChanges);
      expect(regionReport.hasConflicts).toBe(false);
      
      const context: SharedContext = {
        background: '',
        codeSnippets: new Map(),
        outputs: new Map(),
        pendingQuestions: [],
        recentFileChanges: new Map()
      };
      const semanticReport = await semanticDetector.detectSemanticConflicts(plannedChanges, context);
      expect(semanticReport.hasConflicts).toBe(false);
    });
  });
});