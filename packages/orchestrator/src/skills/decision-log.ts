import { Decision } from '@agent-orchestrator/core';

export interface DecisionInput {
  decision: string;
  decider: string;
  context: string;
  alternatives: string[];
  impact: string[];
  relatedTasks?: string[];
  relatedFiles?: string[];
}

export interface DecisionLogInput {
  action: 'record' | 'list' | 'query';
  decision?: DecisionInput;
  filters?: {
    decider?: string;
    since?: Date;
    relatedTo?: string;
  };
}

export interface DecisionLogResult {
  success: boolean;
  decision?: Decision;
  decisions?: Decision[];
  reason?: string;
}

export class DecisionLogSkill {
  private decisions: Decision[] = [];

  async execute(input: DecisionLogInput): Promise<DecisionLogResult> {
    switch (input.action) {
      case 'record':
        return this.handleRecord(input);
      case 'list':
        return this.handleList(input);
      case 'query':
        return this.handleQuery(input);
      default:
        return { success: false, reason: `Unknown action: ${(input as any).action}` };
    }
  }

  getAll(): Decision[] {
    return [...this.decisions];
  }

  clear(): void {
    this.decisions = [];
  }

  private async handleRecord(input: DecisionLogInput): Promise<DecisionLogResult> {
    if (!input.decision) {
      return { success: false, reason: 'record requires decision input' };
    }

    const newDecision: Decision = {
      id: this.generateId(),
      timestamp: new Date(),
      decision: input.decision.decision,
      decider: input.decision.decider,
      context: input.decision.context,
      alternatives: input.decision.alternatives,
      impact: input.decision.impact,
      relatedTasks: input.decision.relatedTasks || [],
      relatedFiles: input.decision.relatedFiles || []
    };

    this.decisions.push(newDecision);

    return { success: true, decision: newDecision };
  }

  private handleList(input: DecisionLogInput): DecisionLogResult {
    let filtered = [...this.decisions];

    if (input.filters?.decider) {
      filtered = filtered.filter(d => d.decider === input.filters!.decider);
    }

    if (input.filters?.since) {
      filtered = filtered.filter(d => d.timestamp >= input.filters!.since!);
    }

    return { success: true, decisions: filtered };
  }

  private handleQuery(input: DecisionLogInput): DecisionLogResult {
    const searchTerm = input.filters?.relatedTo?.toLowerCase();
    if (!searchTerm) {
      return { success: true, decisions: [...this.decisions] };
    }

    const matching = this.decisions.filter(d => 
      d.decision.toLowerCase().includes(searchTerm) ||
      d.context.toLowerCase().includes(searchTerm) ||
      d.relatedTasks.some(t => t.toLowerCase().includes(searchTerm)) ||
      d.relatedFiles.some(f => f.toLowerCase().includes(searchTerm))
    );

    return { success: true, decisions: matching };
  }

  private generateId(): string {
    return `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}