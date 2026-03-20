export interface AgentDescriptor {
  id: string;
  name: string;
  command: string;
  args: string[];
  capabilities: string[];
  maxWorkers: number;
}

export interface DispatchRequest {
  agentId: string;
  prompt: string;
  cwd: string;
  files?: string[];
  timeout?: number;
}

export interface DispatchResult {
  workerId: string;
  output: string;
  toolCalls: ToolCall[];
  locksAcquired: string[];
  locksReleased: string[];
  error?: string;
}

export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  timestamp: number;
}

export type WorkerStatus = 'pending' | 'running' | 'completed' | 'error' | 'timeout';

export interface LockStatus {
  file: string;
  locked: boolean;
  lockedBy?: string;
  lockedAt?: number;
}