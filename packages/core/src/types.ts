// Task Types
export type TaskStatus = 
  | 'pending'
  | 'ready'
  | 'assigned'
  | 'executing'
  | 'reviewing'
  | 'revision'
  | 'blocked'
  | 'completed'
  | 'failed';

export interface TaskNode {
  id: string;
  parentId?: string;
  title: string;
  description: string;
  type: 'milestone' | 'task' | 'subtask';
  assignee?: string;
  assignedAt?: Date;
  expectedOutput: {
    type: 'code' | 'document' | 'analysis' | 'decision';
    description: string;
    acceptanceCriteria: string[];
  };
  actualOutput?: {
    summary: string;
    artifacts: string[];
    files: string[];
    completedAt: Date;
  };
  status: TaskStatus;
  statusHistory: {
    status: TaskStatus;
    changedAt: Date;
    changedBy: string;
    reason?: string;
  }[];
  dependencies: string[];
  blockedBy?: string[];
  estimatedFiles: string[];
  children: string[];
}

export interface TaskTree {
  root: string;
  nodes: Map<string, TaskNode>;
}

// Agent Types
export type AgentStatus = 'online' | 'offline' | 'busy' | 'error';

export interface AgentRole {
  id: string;
  name: string;
  description: string;
  skills: {
    id: string;
    name: string;
    tags: string[];
  }[];
  workingDirectory: string;
  endpoint?: string;
  status: AgentStatus;
  currentTask?: string;
}

// Lock Types
export type LockGranularity = 'file' | 'region';
export type LockType = 'exclusive' | 'shared';
export type LockStatus = 'active' | 'released' | 'expired';

export interface CodeRegion {
  startLine: number;
  endLine: number;
  symbolName?: string;
}

export interface FileLock {
  id: string;
  file: string;
  granularity: LockGranularity;
  region?: CodeRegion;
  holder: {
    agentId: string;
    taskId: string;
  };
  type: LockType;
  status: LockStatus;
  acquiredAt: Date;
  expiresAt?: Date;
  waitingQueue: {
    agentId: string;
    taskId: string;
    requestedAt: Date;
  }[];
}

export interface LockState {
  active: FileLock[];
  history: {
    lock: FileLock;
    releasedAt: Date;
    releasedBy: string;
  }[];
}

// Project Brain Types
export interface ProjectBrain {
  id: string;
  name: string;
  version: string;
  goal: {
    description: string;
    successCriteria: string[];
    constraints: string[];
  };
  agents: AgentRole[];
  tasks: TaskTree;
  context: SharedContext;
  decisions: Decision[];
  locks: LockState;
}

export interface SharedContext {
  background: string;
  codeSnippets: Map<string, {
    file: string;
    language: string;
    content: string;
    description: string;
  }>;
  outputs: Map<string, {
    taskId: string;
    agentId: string;
    summary: string;
    artifacts: string[];
  }>;
  pendingQuestions: {
    id: string;
    question: string;
    askedBy: string;
    askedAt: Date;
    resolvedBy?: string;
    answer?: string;
  }[];
  recentFileChanges: Map<string, {
    agentId: string;
    taskId: string;
    regions?: CodeRegion[];
    timestamp: Date;
  }[]>;
}

export interface Decision {
  id: string;
  timestamp: Date;
  decision: string;
  decider: string;
  context: string;
  alternatives: string[];
  impact: string[];
  relatedTasks: string[];
  relatedFiles: string[];
}

// Conflict Detection Types
export interface FileChange {
  file: string;
  type: 'create' | 'modify' | 'delete';
  regions?: CodeRegion[];
  description: string;
  agentId: string;
}

export interface PathConflict {
  file: string;
  lockedBy: { agentId: string };
  requestedBy: string;
}

export interface ConflictReport {
  hasConflicts: boolean;
  pathConflicts: PathConflict[];
  regionConflicts: never[];
  semanticConflicts: never[];
  recommendations: string[];
}

export interface RegionConflict {
  file: string;
  region1: CodeRegion;
  region2: CodeRegion;
  agent1: string;
  agent2: string;
}

export interface RegionConflictReport {
  hasConflicts: boolean;
  conflicts: RegionConflict[];
}