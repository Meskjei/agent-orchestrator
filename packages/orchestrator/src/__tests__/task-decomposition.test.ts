import { describe, it, expect } from 'vitest';
import { TaskDecompositionSkill } from '../skills/task-decomposition';

describe('TaskDecompositionSkill', () => {
  it('should decompose simple task', async () => {
    const skill = new TaskDecompositionSkill();
    
    const result = await skill.execute({
      taskDescription: '将 CardTableViewCell 迁移到 SwiftUI',
      goal: '完成 CardTableViewCell 的迁移',
      constraints: ['保持 API 兼容'],
      availableAgents: [
        { id: 'qoder', name: 'Qoder', description: 'Native 专家', skills: [{ id: 'analyze', name: '分析', tags: ['objc'] }], workingDirectory: '', status: 'online' }
      ]
    });

    expect(result.subtasks.length).toBeGreaterThan(0);
    expect(result.subtasks[0].title).toBeDefined();
  });
});