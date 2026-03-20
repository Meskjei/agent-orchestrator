export interface AgentAdapterConfig {
  name: string;
  description?: string;
  version?: string;
  command: string;
  args?: string[];
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
  inputTemplate?: string;
  model?: string;
  skills?: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
  }>;
}

export interface AdapterContext {
  task: string;
  context: {
    projectGoal?: string;
    agentRole?: string;
    codeSnippets?: Array<{ file: string; content: string; language: string }>;
    locks?: Array<{ file: string; holder: string }>;
    [key: string]: unknown;
  };
}

export interface ToolCallRecord {
  tool: string;
  input: Record<string, unknown>;
  output?: unknown;
  timestamp: number;
}

export interface AdapterResult {
  output: string;
  artifacts?: string[];
  error?: string;
  locksAcquired?: string[];
  locksReleased?: string[];
  toolCalls?: ToolCallRecord[];
}

export interface AgentAdapter {
  config: AgentAdapterConfig;
  execute(context: AdapterContext): Promise<AdapterResult>;
  getStatus(): Promise<{ online: boolean; error?: string }>;
  cancel?(): Promise<void>;
}