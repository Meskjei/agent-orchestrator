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
    codeSnippets?: Array<{ file: string; content: string; language: string }>;
    locks?: Array<{ file: string; holder: string }>;
    [key: string]: unknown;
  };
}

export interface AdapterResult {
  output: string;
  artifacts?: string[];
  error?: string;
}

export interface AgentAdapter {
  config: AgentAdapterConfig;
  execute(context: AdapterContext): Promise<AdapterResult>;
  getStatus(): Promise<{ online: boolean; error?: string }>;
}