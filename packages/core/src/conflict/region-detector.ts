import { CodeRegion, FileChange, RegionConflict, RegionConflictReport } from '../types.js';

export class RegionConflictDetector {
  regionsOverlap(r1: CodeRegion, r2: CodeRegion): boolean {
    return !(r1.endLine < r2.startLine || r2.endLine < r1.startLine);
  }

  detectRegionConflicts(changes: FileChange[]): RegionConflictReport {
    const conflicts: RegionConflict[] = [];
    const fileGroups = this.groupByFile(changes);

    for (const [file, fileChanges] of fileGroups) {
      const changesByRegion = fileChanges.filter(c => c.regions && c.regions.length > 0);
      
      for (let i = 0; i < changesByRegion.length; i++) {
        for (let j = i + 1; j < changesByRegion.length; j++) {
          const change1 = changesByRegion[i];
          const change2 = changesByRegion[j];

          if (change1.agentId === change2.agentId) {
            continue;
          }

          for (const region1 of change1.regions!) {
            for (const region2 of change2.regions!) {
              if (this.regionsOverlap(region1, region2)) {
                conflicts.push({
                  file,
                  region1,
                  region2,
                  agent1: change1.agentId,
                  agent2: change2.agentId
                });
              }
            }
          }
        }
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  }

  private groupByFile(changes: FileChange[]): Map<string, FileChange[]> {
    const groups = new Map<string, FileChange[]>();
    
    for (const change of changes) {
      const existing = groups.get(change.file) || [];
      existing.push(change);
      groups.set(change.file, existing);
    }
    
    return groups;
  }
}