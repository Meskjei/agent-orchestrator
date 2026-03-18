import { describe, it, expect } from 'vitest';
import { RegionConflictDetector } from '../region-detector';
import { CodeRegion } from '../../types';

describe('RegionConflictDetector', () => {
  it('should detect overlapping regions', () => {
    const detector = new RegionConflictDetector();

    const region1: CodeRegion = { startLine: 10, endLine: 20 };
    const region2: CodeRegion = { startLine: 15, endLine: 25 };

    expect(detector.regionsOverlap(region1, region2)).toBe(true);
  });

  it('should not detect non-overlapping regions', () => {
    const detector = new RegionConflictDetector();

    const region1: CodeRegion = { startLine: 10, endLine: 20 };
    const region2: CodeRegion = { startLine: 25, endLine: 35 };

    expect(detector.regionsOverlap(region1, region2)).toBe(false);
  });

  it('should detect region conflict in same file', () => {
    const detector = new RegionConflictDetector();

    const report = detector.detectRegionConflicts([
      {
        file: 'file1.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Test',
        regions: [{ startLine: 10, endLine: 20 }]
      },
      {
        file: 'file1.ts',
        type: 'modify',
        agentId: 'agent-2',
        description: 'Test',
        regions: [{ startLine: 15, endLine: 25 }]
      }
    ]);

    expect(report.hasConflicts).toBe(true);
    expect(report.conflicts.length).toBe(1);
  });

  it('should return no conflicts when regions do not overlap', () => {
    const detector = new RegionConflictDetector();

    const report = detector.detectRegionConflicts([
      {
        file: 'file1.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Test',
        regions: [{ startLine: 10, endLine: 20 }]
      },
      {
        file: 'file1.ts',
        type: 'modify',
        agentId: 'agent-2',
        description: 'Test',
        regions: [{ startLine: 30, endLine: 40 }]
      }
    ]);

    expect(report.hasConflicts).toBe(false);
    expect(report.conflicts.length).toBe(0);
  });

  it('should not detect conflict when same agent modifies same file', () => {
    const detector = new RegionConflictDetector();

    const report = detector.detectRegionConflicts([
      {
        file: 'file1.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Test 1',
        regions: [{ startLine: 10, endLine: 20 }]
      },
      {
        file: 'file1.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Test 2',
        regions: [{ startLine: 15, endLine: 25 }]
      }
    ]);

    expect(report.hasConflicts).toBe(false);
  });

  it('should not detect conflict for changes in different files', () => {
    const detector = new RegionConflictDetector();

    const report = detector.detectRegionConflicts([
      {
        file: 'file1.ts',
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

    expect(report.hasConflicts).toBe(false);
  });

  it('should handle changes without regions', () => {
    const detector = new RegionConflictDetector();

    const report = detector.detectRegionConflicts([
      {
        file: 'file1.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Test'
      },
      {
        file: 'file1.ts',
        type: 'modify',
        agentId: 'agent-2',
        description: 'Test',
        regions: [{ startLine: 10, endLine: 20 }]
      }
    ]);

    expect(report.hasConflicts).toBe(false);
  });

  it('should detect multiple conflicts', () => {
    const detector = new RegionConflictDetector();

    const report = detector.detectRegionConflicts([
      {
        file: 'file1.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Test',
        regions: [{ startLine: 10, endLine: 20 }, { startLine: 50, endLine: 60 }]
      },
      {
        file: 'file1.ts',
        type: 'modify',
        agentId: 'agent-2',
        description: 'Test',
        regions: [{ startLine: 15, endLine: 25 }, { startLine: 55, endLine: 65 }]
      }
    ]);

    expect(report.hasConflicts).toBe(true);
    expect(report.conflicts.length).toBe(2);
  });

  it('should detect adjacent regions as non-overlapping', () => {
    const detector = new RegionConflictDetector();

    const region1: CodeRegion = { startLine: 10, endLine: 20 };
    const region2: CodeRegion = { startLine: 21, endLine: 30 };

    expect(detector.regionsOverlap(region1, region2)).toBe(false);
  });

  it('should detect regions that touch as overlapping', () => {
    const detector = new RegionConflictDetector();

    const region1: CodeRegion = { startLine: 10, endLine: 20 };
    const region2: CodeRegion = { startLine: 20, endLine: 30 };

    expect(detector.regionsOverlap(region1, region2)).toBe(true);
  });

  it('should include symbolName in conflict report', () => {
    const detector = new RegionConflictDetector();

    const report = detector.detectRegionConflicts([
      {
        file: 'file1.ts',
        type: 'modify',
        agentId: 'agent-1',
        description: 'Test',
        regions: [{ startLine: 10, endLine: 20, symbolName: 'functionA' }]
      },
      {
        file: 'file1.ts',
        type: 'modify',
        agentId: 'agent-2',
        description: 'Test',
        regions: [{ startLine: 15, endLine: 25, symbolName: 'functionB' }]
      }
    ]);

    expect(report.hasConflicts).toBe(true);
    expect(report.conflicts[0].region1.symbolName).toBe('functionA');
    expect(report.conflicts[0].region2.symbolName).toBe('functionB');
  });
});