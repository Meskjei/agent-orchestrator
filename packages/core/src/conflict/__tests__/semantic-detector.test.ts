import { describe, it, expect } from 'vitest';
import { SemanticConflictDetector } from '../semantic-detector';
import { FileChange, SharedContext } from '../../types';

describe('SemanticConflictDetector', () => {
  it('should detect API breaking changes', async () => {
    const detector = new SemanticConflictDetector();

    const plannedChanges: FileChange[] = [
      {
        file: 'api.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Changed function signature',
        regions: [{ startLine: 10, endLine: 20 }]
      }
    ];

    const context: SharedContext = {
      background: 'API module',
      codeSnippets: new Map([
        ['api.ts', {
          file: 'api.ts',
          language: 'typescript',
          content: 'export function getData(id: string): Promise<Data>',
          description: 'API function'
        }]
      ]),
      outputs: new Map(),
      pendingQuestions: [],
      recentFileChanges: new Map([['other.ts', [{ agentId: 'agent-2', taskId: 'task-1', timestamp: new Date() }]]])
    };

    const report = await detector.detectSemanticConflicts(plannedChanges, context);

    expect(report).toBeDefined();
    expect(report.conflicts).toBeDefined();
    expect(report.conflicts.some(c => c.type === 'api_breaking_change')).toBe(true);
  });

  it('should return empty conflicts for non-breaking changes', async () => {
    const detector = new SemanticConflictDetector();

    const plannedChanges: FileChange[] = [
      {
        file: 'utils.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Added helper function',
        regions: [{ startLine: 1, endLine: 10 }]
      }
    ];

    const context: SharedContext = {
      background: 'Utility module',
      codeSnippets: new Map(),
      outputs: new Map(),
      pendingQuestions: [],
      recentFileChanges: new Map()
    };

    const report = await detector.detectSemanticConflicts(plannedChanges, context);

    expect(report.conflicts.length).toBe(0);
  });

  it('should detect interface mismatches when modifying type definitions', async () => {
    const detector = new SemanticConflictDetector();

    const plannedChanges: FileChange[] = [
      {
        file: 'types.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Updated interface',
        regions: [{ startLine: 5, endLine: 15 }]
      }
    ];

    const context: SharedContext = {
      background: 'Type definitions',
      codeSnippets: new Map([
        ['types.ts', {
          file: 'types.ts',
          language: 'typescript',
          content: 'export interface User { id: string; name: string; }',
          description: 'User type'
        }]
      ]),
      outputs: new Map(),
      pendingQuestions: [],
      recentFileChanges: new Map([['other.ts', [{ agentId: 'agent-2', taskId: 'task-2', timestamp: new Date() }]]])
    };

    const report = await detector.detectSemanticConflicts(plannedChanges, context);

    expect(report.conflicts.some(c => c.type === 'interface_mismatch')).toBe(true);
  });

  it('should detect dependency changes when multiple agents work in same directory', async () => {
    const detector = new SemanticConflictDetector();

    const plannedChanges: FileChange[] = [
      {
        file: 'src/components/Button.tsx',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Updated button component'
      },
      {
        file: 'src/components/Input.tsx',
        type: 'modify',
        agentId: 'agent-2',
        description: 'Updated input component'
      }
    ];

    const context: SharedContext = {
      background: 'Component library',
      codeSnippets: new Map(),
      outputs: new Map(),
      pendingQuestions: [],
      recentFileChanges: new Map()
    };

    const report = await detector.detectSemanticConflicts(plannedChanges, context);

    expect(report.conflicts.some(c => c.type === 'dependency_change')).toBe(true);
    expect(report.conflicts.some(c => c.affectedAgents.includes('agent-1') || c.affectedAgents.includes('agent-2'))).toBe(true);
  });

  it('should detect data format changes in JSON files', async () => {
    const detector = new SemanticConflictDetector();

    const plannedChanges: FileChange[] = [
      {
        file: 'config.json',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Updated configuration'
      }
    ];

    const context: SharedContext = {
      background: 'Configuration',
      codeSnippets: new Map([
        ['config.json', {
          file: 'config.json',
          language: 'json',
          content: '{ "version": "1.0.0" }',
          description: 'Config file'
        }]
      ]),
      outputs: new Map(),
      pendingQuestions: [],
      recentFileChanges: new Map([['other.ts', [{ agentId: 'agent-2', taskId: 'task-1', timestamp: new Date() }]]])
    };

    const report = await detector.detectSemanticConflicts(plannedChanges, context);

    expect(report.conflicts.some(c => c.type === 'data_format_change')).toBe(true);
  });

  it('should set hasConflicts to false when no conflicts found', async () => {
    const detector = new SemanticConflictDetector();

    const plannedChanges: FileChange[] = [
      {
        file: 'readme.md',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Updated documentation'
      }
    ];

    const context: SharedContext = {
      background: 'Documentation',
      codeSnippets: new Map(),
      outputs: new Map(),
      pendingQuestions: [],
      recentFileChanges: new Map()
    };

    const report = await detector.detectSemanticConflicts(plannedChanges, context);

    expect(report.hasConflicts).toBe(false);
  });

  it('should set hasConflicts to true when conflicts found', async () => {
    const detector = new SemanticConflictDetector();

    const plannedChanges: FileChange[] = [
      {
        file: 'api.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Changed function signature'
      }
    ];

    const context: SharedContext = {
      background: 'API module',
      codeSnippets: new Map([
        ['api.ts', {
          file: 'api.ts',
          language: 'typescript',
          content: 'export function getData(): Promise<Data>',
          description: 'API function'
        }]
      ]),
      outputs: new Map(),
      pendingQuestions: [],
      recentFileChanges: new Map([['other.ts', [{ agentId: 'agent-2', taskId: 'task-1', timestamp: new Date() }]]])
    };

    const report = await detector.detectSemanticConflicts(plannedChanges, context);

    expect(report.hasConflicts).toBe(true);
  });

  it('should include suggestion in conflict report', async () => {
    const detector = new SemanticConflictDetector();

    const plannedChanges: FileChange[] = [
      {
        file: 'api.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Changed function signature'
      }
    ];

    const context: SharedContext = {
      background: 'API module',
      codeSnippets: new Map([
        ['api.ts', {
          file: 'api.ts',
          language: 'typescript',
          content: 'export function getData(): Promise<Data>',
          description: 'API function'
        }]
      ]),
      outputs: new Map(),
      pendingQuestions: [],
      recentFileChanges: new Map([['other.ts', [{ agentId: 'agent-2', taskId: 'task-1', timestamp: new Date() }]]])
    };

    const report = await detector.detectSemanticConflicts(plannedChanges, context);

    const apiConflict = report.conflicts.find(c => c.type === 'api_breaking_change');
    expect(apiConflict).toBeDefined();
    expect(apiConflict!.suggestion.length).toBeGreaterThan(0);
  });

  it('should set correct severity levels', async () => {
    const detector = new SemanticConflictDetector();

    const plannedChanges: FileChange[] = [
      {
        file: 'api.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Changed API'
      },
      {
        file: 'types.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Changed types'
      }
    ];

    const context: SharedContext = {
      background: 'API module',
      codeSnippets: new Map([
        ['api.ts', {
          file: 'api.ts',
          language: 'typescript',
          content: 'export function getData(): Promise<Data>',
          description: 'API function'
        }],
        ['types.ts', {
          file: 'types.ts',
          language: 'typescript',
          content: 'export interface Data { id: string }',
          description: 'Data type'
        }]
      ]),
      outputs: new Map(),
      pendingQuestions: [],
      recentFileChanges: new Map([['other.ts', [{ agentId: 'agent-2', taskId: 'task-1', timestamp: new Date() }]]])
    };

    const report = await detector.detectSemanticConflicts(plannedChanges, context);

    const apiConflict = report.conflicts.find(c => c.type === 'api_breaking_change');
    const interfaceConflict = report.conflicts.find(c => c.type === 'interface_mismatch');
    
    expect(apiConflict!.severity).toBe('high');
    expect(interfaceConflict!.severity).toBe('high');
  });

  it('should detect exported class modifications as API breaking changes', async () => {
    const detector = new SemanticConflictDetector();

    const plannedChanges: FileChange[] = [
      {
        file: 'service.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Modified service class'
      }
    ];

    const context: SharedContext = {
      background: 'Service module',
      codeSnippets: new Map([
        ['service.ts', {
          file: 'service.ts',
          language: 'typescript',
          content: 'export class DataService { fetchData() {} }',
          description: 'Service class'
        }]
      ]),
      outputs: new Map(),
      pendingQuestions: [],
      recentFileChanges: new Map([['other.ts', [{ agentId: 'agent-2', taskId: 'task-1', timestamp: new Date() }]]])
    };

    const report = await detector.detectSemanticConflicts(plannedChanges, context);

    expect(report.conflicts.some(c => c.type === 'api_breaking_change')).toBe(true);
  });

  it('should detect exported async function as API breaking change', async () => {
    const detector = new SemanticConflictDetector();

    const plannedChanges: FileChange[] = [
      {
        file: 'api.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Changed async function'
      }
    ];

    const context: SharedContext = {
      background: 'API module',
      codeSnippets: new Map([
        ['api.ts', {
          file: 'api.ts',
          language: 'typescript',
          content: 'export async function fetchData(): Promise<Data>',
          description: 'Async API function'
        }]
      ]),
      outputs: new Map(),
      pendingQuestions: [],
      recentFileChanges: new Map([['other.ts', [{ agentId: 'agent-2', taskId: 'task-1', timestamp: new Date() }]]])
    };

    const report = await detector.detectSemanticConflicts(plannedChanges, context);

    expect(report.conflicts.some(c => c.type === 'api_breaking_change')).toBe(true);
  });

  it('should not detect conflicts for create operations', async () => {
    const detector = new SemanticConflictDetector();

    const plannedChanges: FileChange[] = [
      {
        file: 'new-api.ts',
        type: 'create',
        agentId: 'agent-1',
        description: 'Created new API file'
      }
    ];

    const context: SharedContext = {
      background: 'API module',
      codeSnippets: new Map([
        ['new-api.ts', {
          file: 'new-api.ts',
          language: 'typescript',
          content: 'export function newApi(): void {}',
          description: 'New API'
        }]
      ]),
      outputs: new Map(),
      pendingQuestions: [],
      recentFileChanges: new Map([['other.ts', [{ agentId: 'agent-2', taskId: 'task-1', timestamp: new Date() }]]])
    };

    const report = await detector.detectSemanticConflicts(plannedChanges, context);

    expect(report.conflicts.some(c => c.type === 'api_breaking_change')).toBe(false);
    expect(report.conflicts.some(c => c.type === 'interface_mismatch')).toBe(false);
  });

  it('should detect type alias modifications as interface mismatches', async () => {
    const detector = new SemanticConflictDetector();

    const plannedChanges: FileChange[] = [
      {
        file: 'types.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Changed type alias'
      }
    ];

    const context: SharedContext = {
      background: 'Type definitions',
      codeSnippets: new Map([
        ['types.ts', {
          file: 'types.ts',
          language: 'typescript',
          content: 'export type UserID = string;',
          description: 'Type alias'
        }]
      ]),
      outputs: new Map(),
      pendingQuestions: [],
      recentFileChanges: new Map([['other.ts', [{ agentId: 'agent-2', taskId: 'task-1', timestamp: new Date() }]]])
    };

    const report = await detector.detectSemanticConflicts(plannedChanges, context);

    expect(report.conflicts.some(c => c.type === 'interface_mismatch')).toBe(true);
  });

  it('should detect data format changes with JSON methods', async () => {
    const detector = new SemanticConflictDetector();

    const plannedChanges: FileChange[] = [
      {
        file: 'parser.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Updated parser'
      }
    ];

    const context: SharedContext = {
      background: 'Parser module',
      codeSnippets: new Map([
        ['parser.ts', {
          file: 'parser.ts',
          language: 'typescript',
          content: 'const data = JSON.parse(input);',
          description: 'Parser code'
        }]
      ]),
      outputs: new Map(),
      pendingQuestions: [],
      recentFileChanges: new Map([['other.ts', [{ agentId: 'agent-2', taskId: 'task-1', timestamp: new Date() }]]])
    };

    const report = await detector.detectSemanticConflicts(plannedChanges, context);

    expect(report.conflicts.some(c => c.type === 'data_format_change')).toBe(true);
  });

  it('should not create duplicate conflicts for same agent', async () => {
    const detector = new SemanticConflictDetector();

    const plannedChanges: FileChange[] = [
      {
        file: 'api.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Changed API'
      }
    ];

    const context: SharedContext = {
      background: 'API module',
      codeSnippets: new Map([
        ['api.ts', {
          file: 'api.ts',
          language: 'typescript',
          content: 'export function getData(): Promise<Data>',
          description: 'API function'
        }]
      ]),
      outputs: new Map(),
      pendingQuestions: [],
      recentFileChanges: new Map()
    };

    const report = await detector.detectSemanticConflicts(plannedChanges, context);

    expect(report.hasConflicts).toBe(false);
    expect(report.conflicts.length).toBe(0);
  });
});