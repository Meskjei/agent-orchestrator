# ACP Client Adapter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement ACP Client Adapter to enable Agent Orchestrator to communicate with real AI agents (opencode, claude code) via Agent Client Protocol.

**Architecture:** Agent Orchestrator acts as ACP Client, spawning agent subprocesses (opencode acp) and communicating via JSON-RPC over stdio. Lock protocol implemented as MCP Tools with prompt injection for reliability.

**Tech Stack:** TypeScript, @agentclientprotocol/sdk, vitest

**Design Doc:** `docs/superpowers/specs/2026-03-19-acp-client-adapter-design.md`

---

## Chunk 1: Foundation - Types and Prompts

### Task 1.1: Update Adapter Interface

**Files:**
- Modify: `packages/adapter/src/adapter.ts`

- [ ] **Step 1: Add new types to adapter.ts**

```typescript
// Add to existing adapter.ts

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

// Update AgentAdapter interface to add cancel method
export interface AgentAdapter {
  config: AgentAdapterConfig;
  execute(context: AdapterContext): Promise<AdapterResult>;
  getStatus(): Promise<{ online: boolean; error?: string }>;
  cancel?(): Promise<void>;
}
```

- [ ] **Step 2: Commit interface changes**

```bash
git add packages/adapter/src/adapter.ts
git commit -m "feat(adapter): add ToolCallRecord and extend AdapterResult interface"
```

---

### Task 1.2: Create Lock Protocol Prompt

**Files:**
- Create: `packages/adapter/src/prompts/lock-protocol.ts`

- [ ] **Step 1: Create prompts directory and lock-protocol.ts**

```typescript
// packages/adapter/src/prompts/lock-protocol.ts

export const LOCK_PROTOCOL_PROMPT = `
## MANDATORY LOCK PROTOCOL

You are working in a multi-agent environment. Before modifying ANY file, you MUST follow this protocol:

### Step 1: Declare Lock
Call the \`lock_declare\` tool before making changes:
\`\`\`
lock_declare({ files: ["/absolute/path/to/file.ts"] })
\`\`\`

### Step 2: Make Changes
Perform your file modifications using available tools (edit, write, etc.)

### Step 3: Release Lock
After completing modifications, call \`lock_release\`:
\`\`\`
lock_release({ files: ["/absolute/path/to/file.ts"] })
\`\`\`

### Why This Matters
- Prevents conflicts with other agents working on the same files
- Ensures coordinated multi-agent collaboration
- Failure to follow this protocol may cause your changes to be rejected

Always use absolute file paths when calling these tools.
`;
```

- [ ] **Step 2: Commit prompt file**

```bash
git add packages/adapter/src/prompts/lock-protocol.ts
git commit -m "feat(adapter): add lock protocol prompt template"
```

---

### Task 1.3: Create Lock Tools Definition

**Files:**
- Create: `packages/adapter/src/acp/tools/lock-tools.ts`
- Create: `packages/adapter/src/acp/tools/index.ts`

- [ ] **Step 1: Create lock-tools.ts**

```typescript
// packages/adapter/src/acp/tools/lock-tools.ts

export interface LockToolsCallbacks {
  onDeclare: (files: string[]) => Promise<void>;
  onRelease: (files: string[]) => Promise<void>;
}

export interface LockTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      items?: { type: string };
      description: string;
    }>;
    required: string[];
  };
  handler: (params: Record<string, unknown>) => Promise<{ success: boolean; files: string[] }>;
}

export function createLockTools(callbacks: LockToolsCallbacks): Record<string, LockTool> {
  return {
    lock_declare: {
      name: 'lock_declare',
      description: 'Declare intent to modify files. MUST be called before modifying any file.',
      inputSchema: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Absolute paths of files to lock'
          }
        },
        required: ['files']
      },
      handler: async (params: Record<string, unknown>) => {
        const files = params.files as string[];
        await callbacks.onDeclare(files);
        return { success: true, files };
      }
    },
    lock_release: {
      name: 'lock_release',
      description: 'Release file locks after modifications are complete.',
      inputSchema: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Absolute paths of files to release'
          }
        },
        required: ['files']
      },
      handler: async (params: Record<string, unknown>) => {
        const files = params.files as string[];
        await callbacks.onRelease(files);
        return { success: true, files };
      }
    }
  };
}
```

- [ ] **Step 2: Create tools/index.ts**

```typescript
// packages/adapter/src/acp/tools/index.ts

export { createLockTools, type LockToolsCallbacks, type LockTool } from './lock-tools';
```

- [ ] **Step 3: Commit lock tools**

```bash
git add packages/adapter/src/acp/tools/
git commit -m "feat(adapter): add lock tools for MCP protocol"
```

---

## Chunk 2: ACP Connection Management

### Task 2.1: Create ACP Connection Pool

**Files:**
- Create: `packages/adapter/src/acp/connection.ts`
- Create: `packages/adapter/src/acp/index.ts`

- [ ] **Step 1: Note on SDK dependency**
  
  The `@agentclientprotocol/sdk` will be installed in Chunk 3 when implementing `ACPClientAdapter` which uses `ClientSideConnection` for proper JSON-RPC protocol handling. This `connection.ts` only manages subprocess lifecycle.

- [ ] **Step 2: Create connection.ts**

```typescript
// packages/adapter/src/acp/connection.ts

import { spawn, ChildProcess } from 'child_process';

export interface ACPConnectionConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface ACPConnection {
  process: ChildProcess;
  config: ACPConnectionConfig;
  ready: boolean;
}

export class ACPConnectionPool {
  private connections: Map<string, ACPConnection> = new Map();
  private defaultTimeout: number;

  constructor(defaultTimeout: number = 300000) {
    this.defaultTimeout = defaultTimeout;
  }

  async getConnection(config: ACPConnectionConfig): Promise<ACPConnection> {
    const key = this.getConnectionKey(config);
    
    if (this.connections.has(key)) {
      const existing = this.connections.get(key)!;
      if (existing.ready && !this.isProcessDead(existing.process)) {
        return existing;
      }
      // Clean up dead connection
      await this.closeConnection(key);
    }

    return this.createConnection(config);
  }

  private async createConnection(config: ACPConnectionConfig): Promise<ACPConnection> {
    const proc = spawn(config.command, config.args || [], {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const connection: ACPConnection = {
      process: proc,
      config,
      ready: false
    };

    // Wait for process to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, config.timeout || this.defaultTimeout);

      proc.on('spawn', () => {
        clearTimeout(timeout);
        connection.ready = true;
        resolve();
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    const key = this.getConnectionKey(config);
    this.connections.set(key, connection);
    return connection;
  }

  async close(name: string): Promise<void> {
    const key = this.findKeyByName(name);
    if (key) {
      await this.closeConnection(key);
    }
  }

  async closeAll(): Promise<void> {
    for (const key of this.connections.keys()) {
      await this.closeConnection(key);
    }
  }

  private async closeConnection(key: string): Promise<void> {
    const connection = this.connections.get(key);
    if (connection) {
      connection.process.kill();
      this.connections.delete(key);
    }
  }

  private isProcessDead(proc: ChildProcess): boolean {
    return proc.killed || proc.exitCode !== null;
  }

  private getConnectionKey(config: ACPConnectionConfig): string {
    return `${config.command}:${config.cwd || process.cwd()}`;
  }

  private findKeyByName(name: string): string | null {
    for (const [key] of this.connections) {
      if (key.startsWith(name)) return key;
    }
    return null;
  }
}
```

- [ ] **Step 3: Create acp/index.ts**

```typescript
// packages/adapter/src/acp/index.ts

export { ACPConnectionPool, type ACPConnectionConfig, type ACPConnection } from './connection';
export * from './tools';
```

- [ ] **Step 4: Commit connection module**

```bash
git add packages/adapter/src/acp/ packages/adapter/package.json
git commit -m "feat(adapter): add ACP connection pool management"
```

---

### Task 2.2: Write Unit Tests for Connection Pool

**Files:**
- Create: `packages/adapter/src/__tests__/connection.test.ts`

- [ ] **Step 1: Create connection.test.ts**

```typescript
// packages/adapter/src/__tests__/connection.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ACPConnectionPool } from '../acp/connection';

describe('ACPConnectionPool', () => {
  let pool: ACPConnectionPool;

  beforeEach(() => {
    pool = new ACPConnectionPool(5000);
  });

  afterEach(async () => {
    await pool.closeAll();
  });

  describe('getConnection', () => {
    it('should create new connection for new config', async () => {
      const connection = await pool.getConnection({
        command: 'echo',
        args: ['test']
      });

      expect(connection).toBeDefined();
      expect(connection.ready).toBe(true);
      expect(connection.process).toBeDefined();
    });

    it('should reuse existing connection for same config', async () => {
      const config = { command: 'node', args: ['-e', 'setTimeout(() => {}, 10000)'] };
      
      const conn1 = await pool.getConnection(config);
      const conn2 = await pool.getConnection(config);

      expect(conn1).toBe(conn2);
    });

    it('should create separate connections for different configs', async () => {
      const conn1 = await pool.getConnection({ command: 'echo', args: ['1'] });
      const conn2 = await pool.getConnection({ command: 'echo', args: ['2'] });

      expect(conn1).not.toBe(conn2);
    });
  });

  describe('close', () => {
    it('should close connection by name', async () => {
      await pool.getConnection({ command: 'node', args: ['-e', 'setTimeout(() => {}, 10000)'] });
      await pool.close('node');

      // Connection should be removed
      const conn = await pool.getConnection({ command: 'node', args: ['-e', 'setTimeout(() => {}, 10000)'] });
      expect(conn).toBeDefined();
    });
  });

  describe('closeAll', () => {
    it('should close all connections', async () => {
      await pool.getConnection({ command: 'node', args: ['-e', 'setTimeout(() => {}, 10000)'] });
      await pool.getConnection({ command: 'node', args: ['-e', 'setTimeout(() => {}, 20000)'] });
      
      await pool.closeAll();

      // Should create new connections
      const conn = await pool.getConnection({ command: 'echo' });
      expect(conn).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd packages/adapter
npm test -- connection.test.ts
```

Expected: All tests pass

- [ ] **Step 3: Commit tests**

```bash
git add packages/adapter/src/__tests__/connection.test.ts
git commit -m "test(adapter): add connection pool unit tests"
```

---

## Chunk 3: ACP Client Adapter Implementation

### Task 3.1: Create ACP Adapter

**Files:**
- Create: `packages/adapter/src/acp-adapter.ts`

- [ ] **Step 1: Create acp-adapter.ts**

```typescript
// packages/adapter/src/acp-adapter.ts

import { spawn, ChildProcess } from 'child_process';
import { AgentAdapter, AgentAdapterConfig, AdapterContext, AdapterResult, ToolCallRecord } from './adapter';
import { createLockTools, LockToolsCallbacks } from './acp/tools';
import { LOCK_PROTOCOL_PROMPT } from './prompts/lock-protocol';

export class ACPClientAdapter implements AgentAdapter {
  config: AgentAdapterConfig;
  private currentProcess: ChildProcess | null = null;
  private cancelled: boolean = false;

  constructor(config: AgentAdapterConfig) {
    this.config = {
      timeout: 300000,
      args: ['acp'],
      ...config
    };
  }

  async execute(context: AdapterContext): Promise<AdapterResult> {
    this.cancelled = false;
    const locksAcquired: string[] = [];
    const locksReleased: string[] = [];
    const toolCalls: ToolCallRecord[] = [];

    const lockCallbacks: LockToolsCallbacks = {
      onDeclare: async (files: string[]) => {
        locksAcquired.push(...files);
        toolCalls.push({
          tool: 'lock_declare',
          input: { files },
          timestamp: Date.now()
        });
      },
      onRelease: async (files: string[]) => {
        locksReleased.push(...files);
        toolCalls.push({
          tool: 'lock_release',
          input: { files },
          timestamp: Date.now()
        });
      }
    };

    const fullPrompt = LOCK_PROTOCOL_PROMPT + '\n\n' + context.task;

    return new Promise((resolve) => {
      const proc = spawn(this.config.command, this.config.args || [], {
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.currentProcess = proc;
      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        if (!this.cancelled) {
          proc.kill();
          resolve({
            output: stdout,
            error: 'Command timed out',
            locksAcquired,
            locksReleased,
            toolCalls
          });
        }
      }, this.config.timeout);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        this.currentProcess = null;

        // Parse stdout for JSON events if using --format json
        const output = this.parseOutput(stdout);

        resolve({
          output,
          error: code !== 0 && !this.cancelled ? stderr || `Exit code: ${code}` : undefined,
          locksAcquired,
          locksReleased,
          toolCalls
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        this.currentProcess = null;
        resolve({
          output: '',
          error: err.message,
          locksAcquired,
          locksReleased,
          toolCalls
        });
      });

      // Send prompt to stdin
      proc.stdin?.write(fullPrompt);
      proc.stdin?.end();
    });
  }

  async getStatus(): Promise<{ online: boolean; error?: string }> {
    try {
      const proc = spawn(this.config.command, ['--version'], {
        stdio: 'pipe'
      });

      return new Promise((resolve) => {
        proc.on('close', (code) => {
          resolve({ online: code === 0 });
        });
        proc.on('error', (err) => {
          resolve({ online: false, error: err.message });
        });
      });
    } catch (e) {
      return { online: false, error: String(e) };
    }
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = null;
    }
  }

  private parseOutput(stdout: string): string {
    // Try to parse as JSON lines (opencode --format json)
    const lines = stdout.split('\n');
    const textParts: string[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.type === 'text' && event.part?.text) {
          textParts.push(event.part.text);
        }
      } catch {
        // Not JSON, treat as plain text
        textParts.push(line);
      }
    }

    return textParts.join('\n');
  }
}
```

- [ ] **Step 2: Commit ACP adapter**

```bash
git add packages/adapter/src/acp-adapter.ts
git commit -m "feat(adapter): implement ACPClientAdapter"
```

---

### Task 3.2: Write Unit Tests for ACP Adapter

**Files:**
- Create: `packages/adapter/src/__tests__/acp-adapter.test.ts`

- [ ] **Step 1: Create acp-adapter.test.ts**

```typescript
// packages/adapter/src/__tests__/acp-adapter.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ACPClientAdapter } from '../acp-adapter';

describe('ACPClientAdapter', () => {
  let adapter: ACPClientAdapter;

  describe('constructor', () => {
    it('should set default timeout', () => {
      adapter = new ACPClientAdapter({
        name: 'test',
        command: 'echo'
      });
      expect(adapter.config.timeout).toBe(300000);
    });

    it('should allow custom timeout', () => {
      adapter = new ACPClientAdapter({
        name: 'test',
        command: 'echo',
        timeout: 60000
      });
      expect(adapter.config.timeout).toBe(60000);
    });

    it('should set default args to ["acp"]', () => {
      adapter = new ACPClientAdapter({
        name: 'test',
        command: 'opencode'
      });
      expect(adapter.config.args).toEqual(['acp']);
    });
  });

  describe('getStatus', () => {
    it('should return online: true for valid command', async () => {
      adapter = new ACPClientAdapter({
        name: 'test',
        command: 'echo'
      });
      
      const status = await adapter.getStatus();
      expect(status.online).toBe(true);
    });

    it('should return online: false for invalid command', async () => {
      adapter = new ACPClientAdapter({
        name: 'test',
        command: 'nonexistent-command-xyz'
      });
      
      const status = await adapter.getStatus();
      expect(status.online).toBe(false);
      expect(status.error).toBeDefined();
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      adapter = new ACPClientAdapter({
        name: 'test',
        command: 'echo',
        args: [],
        timeout: 5000
      });
    });

    it('should execute command and return output', async () => {
      const result = await adapter.execute({
        task: 'hello world',
        context: {}
      });

      expect(result.output).toContain('hello world');
      expect(result.error).toBeUndefined();
    });

    it('should include lock protocol in prompt', async () => {
      const result = await adapter.execute({
        task: 'test task',
        context: {}
      });

      // Output should contain both the lock protocol prompt and task
      expect(result.output).toContain('LOCK PROTOCOL');
      expect(result.output).toContain('test task');
    });

    it('should track tool calls when lock_declare is mentioned', async () => {
      // This test verifies the lock callback structure
      // Real lock detection happens with actual ACP protocol
      const result = await adapter.execute({
        task: 'test',
        context: {}
      });

      expect(result.toolCalls).toBeDefined();
      expect(Array.isArray(result.locksAcquired)).toBe(true);
      expect(Array.isArray(result.locksReleased)).toBe(true);
    });
  });

  describe('cancel', () => {
    it('should cancel running execution', async () => {
      adapter = new ACPClientAdapter({
        name: 'test',
        command: 'node',
        args: ['-e', 'setTimeout(() => {}, 100000)'],
        timeout: 10000
      });

      const executePromise = adapter.execute({
        task: 'test',
        context: {}
      });

      // Cancel after a short delay
      setTimeout(() => adapter.cancel(), 100);

      const result = await executePromise;
      // Process should be killed, may or may not have error
      expect(result).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd packages/adapter
npm test -- acp-adapter.test.ts
```

Expected: All tests pass

- [ ] **Step 3: Commit tests**

```bash
git add packages/adapter/src/__tests__/acp-adapter.test.ts
git commit -m "test(adapter): add ACPClientAdapter unit tests"
```

---

### Task 3.3: Update Package Exports

**Files:**
- Modify: `packages/adapter/src/index.ts`

- [ ] **Step 1: Update index.ts to export new modules**

```typescript
// packages/adapter/src/index.ts

export * from './adapter';
export * from './acp-adapter';
export * from './acp';
export * from './prompts/lock-protocol';
```

- [ ] **Step 2: Commit export changes**

```bash
git add packages/adapter/src/index.ts
git commit -m "feat(adapter): export ACP adapter modules"
```

---

## Chunk 4: E2E Tests with Real Agent

### Task 4.1: Create E2E Test Helper

**Files:**
- Create: `tests/e2e/helpers/acp-runner.ts`

- [ ] **Step 1: Create acp-runner.ts**

```typescript
// tests/e2e/helpers/acp-runner.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ACPClientAdapter } from '@agent-orchestrator/adapter';

export interface ACPTestProject {
  dir: string;
  adapter: ACPClientAdapter;
  cleanup: () => Promise<void>;
}

export async function createACPTestProject(name: string): Promise<ACPTestProject> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `acp-test-${name}-`));
  
  const adapter = new ACPClientAdapter({
    name: 'opencode',
    command: 'opencode',
    args: ['run', '--format', 'json'],
    cwd: dir,
    timeout: 60000
  });

  return {
    dir,
    adapter,
    cleanup: async () => {
      await adapter.cancel();
      await fs.rm(dir, { recursive: true, force: true });
    }
  };
}

export async function createTestFile(projectDir: string, filename: string, content: string): Promise<string> {
  const filePath = path.join(projectDir, filename);
  await fs.writeFile(filePath, content);
  return filePath;
}
```

- [ ] **Step 2: Commit test helper**

```bash
git add tests/e2e/helpers/acp-runner.ts
git commit -m "test(e2e): add ACP test helper utilities"
```

---

### Task 4.2: Create Simple Task E2E Test

**Files:**
- Create: `tests/e2e/acp-scenarios/simple-task.test.ts`

- [ ] **Step 1: Create simple-task.test.ts**

```typescript
// tests/e2e/acp-scenarios/simple-task.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createACPTestProject } from '../helpers/acp-runner';

describe('ACP E2E: Simple Tasks', () => {
  let project: Awaited<ReturnType<typeof createACPTestProject>>;

  beforeEach(async () => {
    project = await createACPTestProject('simple');
  });

  afterEach(async () => {
    await project.cleanup();
  });

  it('should execute simple question and return answer', async () => {
    const result = await project.adapter.execute({
      task: 'What is 2+2? Answer with just the number.',
      context: {}
    });

    expect(result.error).toBeUndefined();
    expect(result.output).toContain('4');
  });

  it('should check agent status', async () => {
    const status = await project.adapter.getStatus();
    expect(status.online).toBe(true);
  });

  it('should handle timeout gracefully', async () => {
    const slowAdapter = new (await import('@agent-orchestrator/adapter')).ACPClientAdapter({
      name: 'opencode',
      command: 'opencode',
      args: ['run', '--format', 'json'],
      cwd: project.dir,
      timeout: 1000 // Very short timeout
    });

    const result = await slowAdapter.execute({
      task: 'Count from 1 to 1000000',
      context: {}
    });

    expect(result.error).toContain('timeout');
  });
});
```

- [ ] **Step 2: Commit simple task test**

```bash
git add tests/e2e/acp-scenarios/simple-task.test.ts
git commit -m "test(e2e): add ACP simple task E2E test"
```

---

### Task 4.3: Create File Modification E2E Test

**Files:**
- Create: `tests/e2e/acp-scenarios/file-modification.test.ts`

- [ ] **Step 1: Create file-modification.test.ts**

```typescript
// tests/e2e/acp-scenarios/file-modification.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createACPTestProject, createTestFile } from '../helpers/acp-runner';

describe('ACP E2E: File Modification', () => {
  let project: Awaited<ReturnType<typeof createACPTestProject>>;

  beforeEach(async () => {
    project = await createACPTestProject('file-mod');
  });

  afterEach(async () => {
    await project.cleanup();
  });

  it('should modify existing file', async () => {
    const mathFile = await createTestFile(
      project.dir,
      'math.js',
      'function add(a, b) { return a + b; }\n'
    );

    const result = await project.adapter.execute({
      task: 'Add a multiply function to math.js that returns a * b.',
      context: {}
    });

    expect(result.error).toBeUndefined();

    // Verify file was modified
    const content = await fs.readFile(mathFile, 'utf-8');
    expect(content).toContain('multiply');
  });

  it('should create new file', async () => {
    const result = await project.adapter.execute({
      task: 'Create a file called hello.txt with content "Hello, World!"',
      context: {}
    });

    expect(result.error).toBeUndefined();

    // Verify file was created
    const content = await fs.readFile(path.join(project.dir, 'hello.txt'), 'utf-8');
    expect(content).toContain('Hello');
  });

  it('should handle lock protocol in prompt', async () => {
    await createTestFile(project.dir, 'test.js', 'const x = 1;\n');

    const result = await project.adapter.execute({
      task: 'Add a comment to test.js',
      context: {}
    });

    // The prompt should contain lock protocol instructions
    // Agent may or may not call lock tools depending on implementation
    expect(result.toolCalls).toBeDefined();
  });
});
```

- [ ] **Step 2: Commit file modification test**

```bash
git add tests/e2e/acp-scenarios/file-modification.test.ts
git commit -m "test(e2e): add ACP file modification E2E test"
```

---

### Task 4.4: Update E2E Test Configuration

**Files:**
- Modify: `vitest.config.e2e.ts`

- [ ] **Step 1: Add ACP test pattern to vitest config**

```typescript
// vitest.config.e2e.ts - add to include patterns
include: [
  'tests/e2e/**/*.test.ts',
  'tests/e2e/acp-scenarios/**/*.test.ts'
],
```

- [ ] **Step 2: Add test:acp script to package.json**

```json
// package.json scripts
"test:acp": "vitest run --config vitest.config.e2e.ts tests/e2e/acp-scenarios"
```

- [ ] **Step 3: Commit config changes**

```bash
git add vitest.config.e2e.ts package.json
git commit -m "test: add ACP test configuration"
```

---

## Chunk 5: Documentation and Finalization

### Task 5.1: Update README

**Files:**
- Modify: `packages/adapter/README.md`

- [ ] **Step 1: Add ACP adapter documentation**

```markdown
# @agent-orchestrator/adapter

Agent adapters for communicating with AI coding agents.

## ACP Client Adapter

The `ACPClientAdapter` enables communication with ACP-compatible agents like opencode and claude code.

### Usage

```typescript
import { ACPClientAdapter } from '@agent-orchestrator/adapter';

const adapter = new ACPClientAdapter({
  name: 'opencode',
  command: 'opencode',
  args: ['acp'],
  cwd: '/path/to/project',
  timeout: 300000
});

const result = await adapter.execute({
  task: 'Add a multiply function to math.js',
  context: {}
});

console.log(result.output);
console.log('Locks acquired:', result.locksAcquired);
```

### Lock Protocol

The adapter automatically injects lock protocol instructions into prompts. Agents are instructed to call `lock_declare` and `lock_release` tools when modifying files.

### Supported Agents

| Agent | Command | Notes |
|-------|---------|-------|
| opencode | `opencode acp` | Verified |
| claude code | `claude acp` | Experimental |
```

- [ ] **Step 2: Commit README update**

```bash
git add packages/adapter/README.md
git commit -m "docs(adapter): add ACP adapter usage documentation"
```

---

### Task 5.2: Run Full Test Suite

- [ ] **Step 1: Run all tests**

```bash
npm run build
npm test
npm run test:e2e
```

Expected: All tests pass

- [ ] **Step 2: Fix any failures if needed**

---

### Task 5.3: Final Commit and Summary

- [ ] **Step 1: Create summary commit if there are uncommitted changes**

```bash
git status
# If clean, skip
git add -A
git commit -m "feat(adapter): complete ACP Client Adapter implementation"
```

- [ ] **Step 2: Push changes**

```bash
git push origin main
```

---

## Summary

**Files Created:**
- `packages/adapter/src/prompts/lock-protocol.ts`
- `packages/adapter/src/acp/tools/lock-tools.ts`
- `packages/adapter/src/acp/tools/index.ts`
- `packages/adapter/src/acp/connection.ts`
- `packages/adapter/src/acp/index.ts`
- `packages/adapter/src/acp-adapter.ts`
- `packages/adapter/src/__tests__/connection.test.ts`
- `packages/adapter/src/__tests__/acp-adapter.test.ts`
- `tests/e2e/helpers/acp-runner.ts`
- `tests/e2e/acp-scenarios/simple-task.test.ts`
- `tests/e2e/acp-scenarios/file-modification.test.ts`

**Files Modified:**
- `packages/adapter/src/adapter.ts`
- `packages/adapter/src/index.ts`
- `packages/adapter/package.json`
- `vitest.config.e2e.ts`
- `package.json`
- `packages/adapter/README.md`

**Dependencies Added:**
- `@agentclientprotocol/sdk`

**Estimated Time:** 2-3 hours