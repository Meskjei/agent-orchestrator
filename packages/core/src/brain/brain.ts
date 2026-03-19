import * as fs from 'fs/promises';
import * as path from 'path';
import { ProjectBrain, TaskNode, AgentRole, LockState, SharedContext, Decision } from '../types.js';
import { BrainPersistence } from './persistence.js';

export class ProjectBrainImpl implements ProjectBrain {
  id: string;
  name: string;
  version: string;
  goal: { description: string; successCriteria: string[]; constraints: string[] };
  agents: AgentRole[];
  tasks: { root: string; nodes: Map<string, TaskNode> };
  context: SharedContext;
  decisions: Decision[];
  locks: LockState;
  
  private persistence: BrainPersistence;

  constructor(baseDir: string, data?: Partial<ProjectBrain>) {
    this.id = data?.id || crypto.randomUUID();
    this.name = data?.name || 'Untitled Project';
    this.version = data?.version || '1.0.0';
    this.goal = data?.goal || { description: '', successCriteria: [], constraints: [] };
    this.agents = data?.agents || [];
    this.tasks = data?.tasks || { root: '', nodes: new Map() };
    this.context = data?.context || {
      background: '',
      codeSnippets: new Map(),
      outputs: new Map(),
      pendingQuestions: [],
      recentFileChanges: new Map()
    };
    this.decisions = data?.decisions || [];
    this.locks = data?.locks || { active: [], history: [] };
    
    this.persistence = new BrainPersistence(baseDir);
  }

  async save(): Promise<void> {
    await this.persistence.save(this);
  }

  async load(): Promise<boolean> {
    const loaded = await this.persistence.load();
    if (loaded) {
      this.id = loaded.id;
      this.name = loaded.name;
      this.version = loaded.version;
      this.goal = loaded.goal;
      this.agents = loaded.agents;
      this.tasks = loaded.tasks;
      this.context = loaded.context;
      this.decisions = loaded.decisions;
      this.locks = loaded.locks;
      return true;
    }
    return false;
  }

  addTask(task: TaskNode): void {
    this.tasks.nodes.set(task.id, task);
  }

  getTask(taskId: string): TaskNode | undefined {
    return this.tasks.nodes.get(taskId);
  }

  updateTaskStatus(taskId: string, status: TaskNode['status'], changedBy: string, reason?: string): void {
    const task = this.tasks.nodes.get(taskId);
    if (task) {
      task.statusHistory.push({ status, changedAt: new Date(), changedBy, reason });
      task.status = status;
    }
  }

  addAgent(agent: AgentRole): void {
    const existing = this.agents.findIndex(a => a.id === agent.id);
    if (existing >= 0) {
      this.agents[existing] = agent;
    } else {
      this.agents.push(agent);
    }
  }

  getAgent(agentId: string): AgentRole | undefined {
    return this.agents.find(a => a.id === agentId);
  }
}