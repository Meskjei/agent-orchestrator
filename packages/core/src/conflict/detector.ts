import { ConflictReport, FileChange, PathConflict } from '../types';
import { LockManager } from '../lock/manager';

export class ConflictDetector {
  constructor(private lockManager: LockManager) {}

  async detectConflicts(plannedChanges: FileChange[]): Promise<ConflictReport> {
    const pathConflicts: PathConflict[] = [];
    const recommendations: string[] = [];

    for (const change of plannedChanges) {
      const lockStatus = this.lockManager.getLockStatus(change.file);
      
      if (lockStatus.locked && lockStatus.holder && lockStatus.holder !== change.agentId) {
        pathConflicts.push({
          file: change.file,
          lockedBy: { agentId: lockStatus.holder },
          requestedBy: change.agentId
        });
        recommendations.push(`File ${change.file} is locked by ${lockStatus.holder}. Wait for release or request hand-off.`);
      }
    }

    return {
      hasConflicts: pathConflicts.length > 0,
      pathConflicts,
      regionConflicts: [],
      semanticConflicts: [],
      recommendations
    };
  }
}