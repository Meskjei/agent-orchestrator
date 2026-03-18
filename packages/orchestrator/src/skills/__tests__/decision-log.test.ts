import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionLogSkill } from '../decision-log';

describe('DecisionLogSkill', () => {
  let skill: DecisionLogSkill;

  beforeEach(() => {
    skill = new DecisionLogSkill();
  });

  it('should record a decision', async () => {
    const result = await skill.execute({
      action: 'record',
      decision: {
        decision: 'Use TypeScript for new project',
        decider: 'human',
        context: 'Technical stack selection',
        alternatives: ['JavaScript', 'Python'],
        impact: ['All developers need TypeScript knowledge']
      }
    });

    expect(result.success).toBe(true);
    expect(result.decision?.id).toBeDefined();
  });

  it('should list decisions', async () => {
    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision 1',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision 2',
        decider: 'agent-1',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    const result = await skill.execute({ action: 'list' });

    expect(result.decisions?.length).toBe(2);
  });

  it('should filter decisions by decider', async () => {
    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision 1',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision 2',
        decider: 'agent-1',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    const result = await skill.execute({ action: 'list', filters: { decider: 'human' } });

    expect(result.decisions?.length).toBe(1);
    expect(result.decisions?.[0].decider).toBe('human');
  });

  it('should filter decisions by since date', async () => {
    const oldDate = new Date('2020-01-01');
    
    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Old Decision',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    const cutoffDate = new Date();

    await skill.execute({
      action: 'record',
      decision: {
        decision: 'New Decision',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    const result = await skill.execute({ action: 'list', filters: { since: cutoffDate } });

    expect(result.decisions?.length).toBe(1);
    expect(result.decisions?.[0].decision).toBe('New Decision');
  });

  it('should query decisions by relatedTo in decision text', async () => {
    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Use React for frontend',
        decider: 'human',
        context: 'Framework selection',
        alternatives: ['Vue', 'Angular'],
        impact: []
      }
    });

    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Use Node.js for backend',
        decider: 'agent-1',
        context: 'Backend selection',
        alternatives: ['Python'],
        impact: []
      }
    });

    const result = await skill.execute({ action: 'query', filters: { relatedTo: 'React' } });

    expect(result.decisions?.length).toBe(1);
    expect(result.decisions?.[0].decision).toBe('Use React for frontend');
  });

  it('should query decisions by relatedTo in context', async () => {
    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision A',
        decider: 'human',
        context: 'Database architecture',
        alternatives: [],
        impact: []
      }
    });

    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision B',
        decider: 'human',
        context: 'API design',
        alternatives: [],
        impact: []
      }
    });

    const result = await skill.execute({ action: 'query', filters: { relatedTo: 'database' } });

    expect(result.decisions?.length).toBe(1);
    expect(result.decisions?.[0].context).toBe('Database architecture');
  });

  it('should query decisions by relatedTo in relatedTasks', async () => {
    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision with task',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: [],
        relatedTasks: ['task-123', 'task-456']
      }
    });

    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision without task',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    const result = await skill.execute({ action: 'query', filters: { relatedTo: 'task-123' } });

    expect(result.decisions?.length).toBe(1);
    expect(result.decisions?.[0].decision).toBe('Decision with task');
  });

  it('should query decisions by relatedTo in relatedFiles', async () => {
    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision about file',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: [],
        relatedFiles: ['src/auth.ts', 'src/user.ts']
      }
    });

    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Other decision',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    const result = await skill.execute({ action: 'query', filters: { relatedTo: 'auth.ts' } });

    expect(result.decisions?.length).toBe(1);
    expect(result.decisions?.[0].decision).toBe('Decision about file');
  });

  it('should return empty array for no matches', async () => {
    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Some decision',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    const result = await skill.execute({ action: 'query', filters: { relatedTo: 'nonexistent' } });

    expect(result.decisions?.length).toBe(0);
  });

  it('should fail record without decision input', async () => {
    const result = await skill.execute({ action: 'record' });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('record requires decision input');
  });

  it('should fail with unknown action', async () => {
    const result = await skill.execute({ action: 'invalid' as any });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('Unknown action');
  });

  it('should return all decisions with getAll', async () => {
    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision 1',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision 2',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    const allDecisions = skill.getAll();
    expect(allDecisions.length).toBe(2);
  });

  it('should clear all decisions', async () => {
    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision 1',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    skill.clear();
    const allDecisions = skill.getAll();
    expect(allDecisions.length).toBe(0);
  });

  it('should generate unique ids for decisions', async () => {
    const result1 = await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision 1',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    const result2 = await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision 2',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    expect(result1.decision?.id).not.toBe(result2.decision?.id);
  });

  it('should set timestamp on decisions', async () => {
    const beforeDate = new Date();
    
    const result = await skill.execute({
      action: 'record',
      decision: {
        decision: 'Timestamped decision',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    const afterDate = new Date();

    expect(result.decision?.timestamp).toBeDefined();
    expect(result.decision!.timestamp >= beforeDate).toBe(true);
    expect(result.decision!.timestamp <= afterDate).toBe(true);
  });

  it('should default empty arrays for relatedTasks and relatedFiles', async () => {
    const result = await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision without relations',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    expect(result.decision?.relatedTasks).toEqual([]);
    expect(result.decision?.relatedFiles).toEqual([]);
  });

  it('should preserve relatedTasks and relatedFiles when provided', async () => {
    const result = await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision with relations',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: [],
        relatedTasks: ['task-1', 'task-2'],
        relatedFiles: ['file1.ts', 'file2.ts']
      }
    });

    expect(result.decision?.relatedTasks).toEqual(['task-1', 'task-2']);
    expect(result.decision?.relatedFiles).toEqual(['file1.ts', 'file2.ts']);
  });

  it('should return a copy from getAll', async () => {
    await skill.execute({
      action: 'record',
      decision: {
        decision: 'Decision 1',
        decider: 'human',
        context: 'Test',
        alternatives: [],
        impact: []
      }
    });

    const decisions1 = skill.getAll();
    const decisions2 = skill.getAll();

    expect(decisions1).not.toBe(decisions2);
    expect(decisions1).toEqual(decisions2);
  });
});