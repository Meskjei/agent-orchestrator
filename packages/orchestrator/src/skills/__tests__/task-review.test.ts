import { describe, it, expect } from 'vitest';
import { TaskReviewSkill } from '../task-review';

describe('TaskReviewSkill', () => {
  it('should review spec compliance', async () => {
    const skill = new TaskReviewSkill();

    const result = await skill.execute({
      task: {
        id: 'T001',
        title: 'Implement feature',
        description: 'Add user authentication',
        type: 'task',
        status: 'reviewing',
        expectedOutput: {
          type: 'code',
          description: 'Auth module',
          acceptanceCriteria: ['Login works', 'Logout works']
        },
        estimatedFiles: ['auth.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      output: {
        summary: 'Implemented auth with login and logout',
        files: ['auth.ts'],
        artifacts: []
      },
      reviewType: 'spec'
    });

    expect(result.passed).toBeDefined();
    expect(result.specReview).toBeDefined();
  });

  it('should detect missing acceptance criteria', async () => {
    const skill = new TaskReviewSkill();

    const result = await skill.execute({
      task: {
        id: 'T001',
        title: 'Test task',
        description: 'Test',
        type: 'task',
        status: 'reviewing',
        expectedOutput: {
          type: 'code',
          description: 'Test output',
          acceptanceCriteria: ['Criteria 1', 'Criteria 2']
        },
        estimatedFiles: [],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      output: {
        summary: 'Only did criteria 1',
        files: [],
        artifacts: []
      },
      reviewType: 'spec'
    });

    expect(result.specReview.missingRequirements.length).toBeGreaterThan(0);
  });

  it('should pass when all acceptance criteria are met', async () => {
    const skill = new TaskReviewSkill();

    const result = await skill.execute({
      task: {
        id: 'T001',
        title: 'Implement feature',
        description: 'Add user authentication',
        type: 'task',
        status: 'reviewing',
        expectedOutput: {
          type: 'code',
          description: 'Auth module',
          acceptanceCriteria: ['Login functionality', 'Logout functionality']
        },
        estimatedFiles: ['auth.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      output: {
        summary: 'Implemented login and logout functionality',
        files: ['auth.ts'],
        artifacts: []
      },
      reviewType: 'spec'
    });

    expect(result.passed).toBe(true);
    expect(result.specReview.compliant).toBe(true);
    expect(result.specReview.missingRequirements).toHaveLength(0);
  });

  it('should perform quality review when requested', async () => {
    const skill = new TaskReviewSkill();

    const result = await skill.execute({
      task: {
        id: 'T001',
        title: 'Test task',
        description: 'Test',
        type: 'task',
        status: 'reviewing',
        expectedOutput: {
          type: 'code',
          description: 'Test output',
          acceptanceCriteria: ['Feature works']
        },
        estimatedFiles: ['test.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      output: {
        summary: 'Implemented the feature with comprehensive tests',
        files: ['test.ts'],
        artifacts: ['test-report.json']
      },
      reviewType: 'quality'
    });

    expect(result.qualityReview).toBeDefined();
    expect(result.qualityReview?.approved).toBe(true);
    expect(result.qualityReview?.strengths.length).toBeGreaterThan(0);
  });

  it('should perform both spec and quality review', async () => {
    const skill = new TaskReviewSkill();

    const result = await skill.execute({
      task: {
        id: 'T001',
        title: 'Test task',
        description: 'Test',
        type: 'task',
        status: 'reviewing',
        expectedOutput: {
          type: 'code',
          description: 'Test output',
          acceptanceCriteria: ['Feature works']
        },
        estimatedFiles: ['feature.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      output: {
        summary: 'Implemented the feature successfully',
        files: ['feature.ts'],
        artifacts: []
      },
      reviewType: 'both'
    });

    expect(result.specReview).toBeDefined();
    expect(result.qualityReview).toBeDefined();
  });

  it('should detect extra work (unexpected files)', async () => {
    const skill = new TaskReviewSkill();

    const result = await skill.execute({
      task: {
        id: 'T001',
        title: 'Test task',
        description: 'Test',
        type: 'task',
        status: 'reviewing',
        expectedOutput: {
          type: 'code',
          description: 'Test output',
          acceptanceCriteria: ['Feature works']
        },
        estimatedFiles: ['expected.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      output: {
        summary: 'Implemented the feature',
        files: ['expected.ts', 'unexpected.ts'],
        artifacts: []
      },
      reviewType: 'spec'
    });

    expect(result.specReview.extraWork.length).toBeGreaterThan(0);
    expect(result.specReview.extraWork[0]).toContain('unexpected.ts');
  });

  it('should require human review for missing requirements', async () => {
    const skill = new TaskReviewSkill();

    const result = await skill.execute({
      task: {
        id: 'T001',
        title: 'Test task',
        description: 'Test',
        type: 'task',
        status: 'reviewing',
        expectedOutput: {
          type: 'code',
          description: 'Test output',
          acceptanceCriteria: ['Criteria 1', 'Criteria 2', 'Criteria 3']
        },
        estimatedFiles: [],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      output: {
        summary: 'Only partial implementation',
        files: [],
        artifacts: []
      },
      reviewType: 'spec'
    });

    expect(result.requiresHumanReview).toBe(true);
  });

  it('should detect quality issues for brief summary', async () => {
    const skill = new TaskReviewSkill();

    const result = await skill.execute({
      task: {
        id: 'T001',
        title: 'Test task',
        description: 'Test',
        type: 'task',
        status: 'reviewing',
        expectedOutput: {
          type: 'code',
          description: 'Test output',
          acceptanceCriteria: []
        },
        estimatedFiles: [],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      output: {
        summary: 'Done',
        files: [],
        artifacts: []
      },
      reviewType: 'quality'
    });

    expect(result.qualityReview?.issues.length).toBeGreaterThan(0);
    expect(result.qualityReview?.issues[0]).toContain('brief');
  });

  it('should detect quality issues for code task with no files', async () => {
    const skill = new TaskReviewSkill();

    const result = await skill.execute({
      task: {
        id: 'T001',
        title: 'Test task',
        description: 'Test',
        type: 'task',
        status: 'reviewing',
        expectedOutput: {
          type: 'code',
          description: 'Test output',
          acceptanceCriteria: []
        },
        estimatedFiles: ['expected.ts'],
        children: [],
        dependencies: [],
        statusHistory: []
      },
      output: {
        summary: 'Task completed successfully with all requirements',
        files: [],
        artifacts: []
      },
      reviewType: 'quality'
    });

    expect(result.qualityReview?.issues).toContainEqual(
      expect.stringContaining('No files produced')
    );
  });
});