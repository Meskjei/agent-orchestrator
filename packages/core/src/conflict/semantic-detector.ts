import { FileChange, SharedContext } from '../types.js';

export interface SemanticConflict {
  type: 'api_breaking_change' | 'dependency_change' | 'interface_mismatch' | 'data_format_change';
  file: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  affectedAgents: string[];
  suggestion: string;
}

export interface SemanticConflictReport {
  hasConflicts: boolean;
  conflicts: SemanticConflict[];
}

export class SemanticConflictDetector {
  async detectSemanticConflicts(
    plannedChanges: FileChange[],
    context: SharedContext
  ): Promise<SemanticConflictReport> {
    const conflicts: SemanticConflict[] = [];
    const allAgents = this.getAllAgents(plannedChanges, context);

    for (const change of plannedChanges) {
      const snippet = context.codeSnippets.get(change.file);
      
      if (snippet) {
        const apiConflicts = this.detectAPIBreakingChanges(change, snippet, allAgents);
        const interfaceConflicts = this.detectInterfaceMismatches(change, snippet, allAgents);
        conflicts.push(...apiConflicts, ...interfaceConflicts);
      }

      const dependencyConflicts = this.detectDependencyChanges(change, plannedChanges, context);
      conflicts.push(...dependencyConflicts);

      const dataFormatConflicts = this.detectDataFormatChanges(change, snippet, allAgents);
      conflicts.push(...dataFormatConflicts);
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  }

  private getAllAgents(changes: FileChange[], context: SharedContext): string[] {
    const agents = new Set<string>();
    
    for (const change of changes) {
      agents.add(change.agentId);
    }
    
    for (const [, changeList] of context.recentFileChanges) {
      for (const change of changeList) {
        agents.add(change.agentId);
      }
    }
    
    return Array.from(agents);
  }

  private detectAPIBreakingChanges(
    change: FileChange,
    snippet: { content: string; file: string },
    allAgents: string[]
  ): SemanticConflict[] {
    const conflicts: SemanticConflict[] = [];
    const content = snippet.content;

    if (change.type !== 'modify') {
      return conflicts;
    }

    const hasExportedFunction = /export\s+(async\s+)?function\s+\w+/.test(content);
    const hasExportedClass = /export\s+class\s+\w+/.test(content);
    const hasExportedInterface = /export\s+interface\s+\w+/.test(content);

    if (hasExportedFunction || hasExportedClass) {
      const affectedAgents = allAgents.filter(a => a !== change.agentId);
      
      if (affectedAgents.length > 0) {
        conflicts.push({
          type: 'api_breaking_change',
          file: change.file,
          description: `Modification to file with exported API (${change.description})`,
          severity: 'high',
          affectedAgents,
          suggestion: 'Coordinate with other agents before modifying exported functions or classes. Consider versioning the API changes.'
        });
      }
    }

    return conflicts;
  }

  private detectInterfaceMismatches(
    change: FileChange,
    snippet: { content: string },
    allAgents: string[]
  ): SemanticConflict[] {
    const conflicts: SemanticConflict[] = [];
    const content = snippet.content;

    if (change.type !== 'modify') {
      return conflicts;
    }

    const hasTypeDefinition = /export\s+(type|interface)\s+\w+/.test(content);
    const hasTypeAlias = /export\s+type\s+\w+\s*=/.test(content);

    if (hasTypeDefinition || hasTypeAlias) {
      const affectedAgents = allAgents.filter(a => a !== change.agentId);
      
      if (affectedAgents.length > 0) {
        conflicts.push({
          type: 'interface_mismatch',
          file: change.file,
          description: `Modification to type definitions in ${change.file}`,
          severity: 'high',
          affectedAgents,
          suggestion: 'Changes to type definitions may cause type errors in other agents\' code. Ensure backward compatibility or coordinate changes.'
        });
      }
    }

    return conflicts;
  }

  private detectDependencyChanges(
    change: FileChange,
    allChanges: FileChange[],
    context: SharedContext
  ): SemanticConflict[] {
    const conflicts: SemanticConflict[] = [];

    const directory = this.getDirectory(change.file);
    const otherAgentsInSameDir: string[] = [];

    for (const otherChange of allChanges) {
      if (otherChange.agentId === change.agentId) continue;
      
      const otherDir = this.getDirectory(otherChange.file);
      if (otherDir === directory) {
        otherAgentsInSameDir.push(otherChange.agentId);
      }
    }

    for (const [, recentChanges] of context.recentFileChanges) {
      for (const recentChange of recentChanges) {
        if (recentChange.agentId === change.agentId) continue;
        
        const recentDir = this.getDirectory(change.file);
        const changeDir = this.getDirectory(change.file);
        if (recentDir === changeDir) {
          otherAgentsInSameDir.push(recentChange.agentId);
        }
      }
    }

    const uniqueAgents = [...new Set(otherAgentsInSameDir)];
    
    if (uniqueAgents.length > 0) {
      conflicts.push({
        type: 'dependency_change',
        file: change.file,
        description: `Other agents working in same directory as ${change.file}`,
        severity: 'medium',
        affectedAgents: uniqueAgents,
        suggestion: 'Multiple agents are working in the same directory. Consider coordinating changes to avoid conflicts.'
      });
    }

    return conflicts;
  }

  private detectDataFormatChanges(
    change: FileChange,
    snippet: { content: string } | undefined,
    allAgents: string[]
  ): SemanticConflict[] {
    const conflicts: SemanticConflict[] = [];

    if (change.type !== 'modify') {
      return conflicts;
    }

    if (!snippet) {
      return conflicts;
    }

    const content = snippet.content;
    const hasDataFormat = 
      /JSON\.(parse|stringify)/.test(content) ||
      /\.json\s*$/.test(change.file) ||
      /schema|model|dto/i.test(content);

    if (hasDataFormat) {
      const affectedAgents = allAgents.filter(a => a !== change.agentId);
      
      if (affectedAgents.length > 0) {
        conflicts.push({
          type: 'data_format_change',
          file: change.file,
          description: `Modification to data format/schema file: ${change.file}`,
          severity: 'medium',
          affectedAgents,
          suggestion: 'Changes to data formats may break data exchange between agents. Coordinate schema changes carefully.'
        });
      }
    }

    return conflicts;
  }

  private getDirectory(filePath: string): string {
    const lastSlash = filePath.lastIndexOf('/');
    if (lastSlash === -1) {
      return '';
    }
    return filePath.substring(0, lastSlash);
  }
}