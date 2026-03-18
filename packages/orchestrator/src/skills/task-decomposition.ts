import { AgentRole } from '@agent-orchestrator/core/types';

interface DecompositionInput {
  taskDescription: string;
  goal: string;
  constraints: string[];
  availableAgents: AgentRole[];
}

interface Subtask {
  id: string;
  title: string;
  description: string;
  type: 'task' | 'subtask';
  estimatedFiles: string[];
  suggestedAgent?: string;
  dependencies?: string[];
}

interface DecompositionResult {
  subtasks: Subtask[];
  dependencies: Map<string, string[]>;
  assignments: Map<string, string[]>;
}

export class TaskDecompositionSkill {
  async execute(input: DecompositionInput): Promise<DecompositionResult> {
    const subtasks: Subtask[] = [];
    const dependencies = new Map<string, string[]>();
    const assignments = new Map<string, string[]>();

    const description = input.taskDescription.toLowerCase();
    
    if (description.includes('迁移') || description.includes('migrate') || description.includes('migration')) {
      subtasks.push({
        id: 'T001',
        title: '分析原始代码',
        description: `分析 ${input.goal} 的原始实现`,
        type: 'task',
        estimatedFiles: [],
        suggestedAgent: this.findAgentBySkill(input.availableAgents, ['analysis', 'analyze', 'objc'])
      });

      subtasks.push({
        id: 'T002',
        title: '设计新实现',
        description: '设计新技术的实现方案',
        type: 'task',
        estimatedFiles: [],
        dependencies: ['T001'],
        suggestedAgent: this.findAgentBySkill(input.availableAgents, ['design', 'architecture'])
      });

      subtasks.push({
        id: 'T003',
        title: '实现新代码',
        description: '根据设计方案实现',
        type: 'task',
        estimatedFiles: [],
        dependencies: ['T002'],
        suggestedAgent: this.findAgentBySkill(input.availableAgents, ['code', 'implement', 'swift'])
      });

      subtasks.push({
        id: 'T004',
        title: '编写测试',
        description: '为新实现编写单元测试',
        type: 'task',
        estimatedFiles: [],
        dependencies: ['T003'],
        suggestedAgent: this.findAgentBySkill(input.availableAgents, ['test', 'testing'])
      });
    } else {
      subtasks.push({
        id: 'T001',
        title: input.taskDescription,
        description: input.goal,
        type: 'task',
        estimatedFiles: []
      });
    }

    for (const task of subtasks) {
      if (task.dependencies) {
        dependencies.set(task.id, task.dependencies);
      }
      if (task.suggestedAgent) {
        assignments.set(task.id, [task.suggestedAgent]);
      }
    }

    return { subtasks, dependencies, assignments };
  }

  private findAgentBySkill(agents: AgentRole[], skillTags: string[]): string | undefined {
    for (const tag of skillTags) {
      const agent = agents.find(a => 
        a.skills.some((s: { tags: string[]; name: string }) => 
          s.tags.includes(tag) || s.name.toLowerCase().includes(tag)
        )
      );
      if (agent) return agent.id;
    }
    return agents[0]?.id;
  }
}