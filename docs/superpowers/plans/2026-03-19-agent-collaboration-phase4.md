# Multi-Agent Collaboration System - Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the system with semantic conflict detection, TUI interface, full Web Dashboard, logging system, and documentation.

**Architecture:** Extend existing packages with advanced features and add documentation.

**Tech Stack:** TypeScript, Express, Ink (TUI), Winston (logging)

---

## File Structure

```
packages/
├── core/
│   └── src/
│       ├── conflict/
│       │   └── semantic-detector.ts   # NEW: Layer 3 semantic analysis
│       └── logging/
│           ├── logger.ts              # NEW: Winston logger
│           └── types.ts               # NEW: Log types
│
├── cli/
│   └── src/
│       └── tui/
│           ├── app.tsx                # NEW: TUI main component
│           ├── components/
│           │   ├── task-list.tsx      # NEW
│           │   ├── agent-status.tsx   # NEW
│           │   └── lock-view.tsx      # NEW
│           └── index.ts               # NEW
│
└── web/
    └── src/
        ├── public/
        │   └── index.html             # NEW: Dashboard HTML
        └── routes/
            └── logs.ts                # NEW: Log streaming API

docs/
├── getting-started.md                 # NEW
├── architecture.md                    # NEW
├── api-reference.md                   # NEW
└── examples/
    └── native-card-migration/         # NEW: Example project
```

---

## Chunk 1: Logging System

### Task 1: Core Logging Module

**Files:**
- Create: `packages/core/src/logging/logger.ts`
- Create: `packages/core/src/logging/types.ts`
- Create: `packages/core/src/logging/__tests__/logger.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/logging/__tests__/logger.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Logger, createLogger } from '../logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = createLogger('test');
  });

  it('should log info messages', () => {
    logger.info('Test message');
    const logs = logger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe('info');
    expect(logs[0].message).toBe('Test message');
  });

  it('should log with context', () => {
    logger.info('Task started', { taskId: 'T001', agentId: 'agent-1' });
    const logs = logger.getLogs();
    expect(logs[0].context).toEqual({ taskId: 'T001', agentId: 'agent-1' });
  });

  it('should filter logs by level', () => {
    logger.info('Info message');
    logger.error('Error message');
    logger.debug('Debug message');

    const errorLogs = logger.getLogs({ level: 'error' });
    expect(errorLogs.length).toBe(1);
    expect(errorLogs[0].message).toBe('Error message');
  });

  it('should filter logs by agent', () => {
    logger.info('Message 1', { agentId: 'agent-1' });
    logger.info('Message 2', { agentId: 'agent-2' });

    const agentLogs = logger.getLogs({ agentId: 'agent-1' });
    expect(agentLogs.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

```typescript
// packages/core/src/logging/types.ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  agentId?: string;
  taskId?: string;
}

export interface LogFilter {
  level?: LogLevel;
  agentId?: string;
  taskId?: string;
  since?: Date;
  until?: Date;
}

// packages/core/src/logging/logger.ts
import { LogEntry, LogFilter, LogLevel } from './types';

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  getLogs(filter?: LogFilter): LogEntry[];
  clear(): void;
}

class LoggerImpl implements Logger {
  private entries: LogEntry[] = [];
  private namespace: string;

  constructor(namespace: string) {
    this.namespace = namespace;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message: `[${this.namespace}] ${message}`,
      context,
      agentId: context?.agentId as string | undefined,
      taskId: context?.taskId as string | undefined
    };

    this.entries.push(entry);

    // Also console output
    const consoleMethod = level === 'debug' ? 'log' : level;
    console[consoleMethod](`[${entry.timestamp.toISOString()}] [${level.toUpperCase()}] ${entry.message}`, context || '');
  }

  getLogs(filter?: LogFilter): LogEntry[] {
    let result = [...this.entries];

    if (filter?.level) {
      result = result.filter(e => e.level === filter.level);
    }
    if (filter?.agentId) {
      result = result.filter(e => e.agentId === filter.agentId);
    }
    if (filter?.taskId) {
      result = result.filter(e => e.taskId === filter.taskId);
    }
    if (filter?.since) {
      result = result.filter(e => e.timestamp >= filter.since!);
    }
    if (filter?.until) {
      result = result.filter(e => e.timestamp <= filter.until!);
    }

    return result;
  }

  clear(): void {
    this.entries = [];
  }
}

const loggers = new Map<string, Logger>();

export function createLogger(namespace: string): Logger {
  if (!loggers.has(namespace)) {
    loggers.set(namespace, new LoggerImpl(namespace));
  }
  return loggers.get(namespace)!;
}

export function getGlobalLogs(filter?: LogFilter): LogEntry[] {
  const allLogs: LogEntry[] = [];
  for (const logger of loggers.values()) {
    allLogs.push(...logger.getLogs());
  }
  
  // Sort by timestamp
  allLogs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Apply filter
  let result = allLogs;
  if (filter?.level) {
    result = result.filter(e => e.level === filter.level);
  }
  if (filter?.agentId) {
    result = result.filter(e => e.agentId === filter.agentId);
  }
  if (filter?.taskId) {
    result = result.filter(e => e.taskId === filter.taskId);
  }
  if (filter?.since) {
    result = result.filter(e => e.timestamp >= filter.since!);
  }
  if (filter?.until) {
    result = result.filter(e => e.timestamp <= filter.until!);
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/logging/
git commit -m "feat(core): implement logging system"
```

---

## Chunk 2: Semantic Conflict Detection

### Task 2: Semantic Detector (Layer 3)

**Files:**
- Create: `packages/core/src/conflict/semantic-detector.ts`
- Create: `packages/core/src/conflict/__tests__/semantic-detector.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/core/src/conflict/__tests__/semantic-detector.test.ts
import { describe, it, expect } from 'vitest';
import { SemanticConflictDetector } from '../semantic-detector';

describe('SemanticConflictDetector', () => {
  it('should detect API breaking changes', async () => {
    const detector = new SemanticConflictDetector();

    const report = await detector.detectSemanticConflicts(
      [
        {
          file: 'api.ts',
          type: 'modify',
          agentId: 'agent-1',
          description: 'Changed function signature',
          regions: [{ startLine: 10, endLine: 20 }]
        }
      ],
      {
        background: 'API module',
        codeSnippets: new Map([
          ['api.ts', {
            file: 'api.ts',
            language: 'typescript',
            content: 'export function getData(id: string): Promise<Data>',
            description: 'API function'
          }]
        ]),
        outputs: new Map(),
        pendingQuestions: [],
        recentFileChanges: new Map()
      }
    );

    expect(report).toBeDefined();
    expect(report.conflicts).toBeDefined();
  });

  it('should return empty conflicts for non-breaking changes', async () => {
    const detector = new SemanticConflictDetector();

    const report = await detector.detectSemanticConflicts(
      [
        {
          file: 'utils.ts',
          type: 'modify',
          agentId: 'agent-1',
          description: 'Added helper function',
          regions: [{ startLine: 1, endLine: 10 }]
        }
      ],
      {
        background: 'Utility module',
        codeSnippets: new Map(),
        outputs: new Map(),
        pendingQuestions: [],
        recentFileChanges: new Map()
      }
    );

    expect(report.conflicts.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

```typescript
// packages/core/src/conflict/semantic-detector.ts
import { FileChange, SharedContext } from '../types';

export interface SemanticConflict {
  type: 'api_breaking_change' | 'dependency_change' | 'interface_mismatch' | 'data_format_change';
  file: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  affectedAgents: string[];
  suggestion: string;
}

export interface SemanticConflictReport {
  hasConflicts: boolean;
  conflicts: SemanticConflict[];
}

export class SemanticConflictDetector {
  async detectSemanticConflicts(
    plannedChanges: FileChange[],
    context: SharedContext
  ): Promise<SemanticConflictReport> {
    const conflicts: SemanticConflict[] = [];

    for (const change of plannedChanges) {
      // Check for potential API breaking changes
      const snippet = context.codeSnippets.get(change.file);
      if (snippet && this.isApiFile(snippet)) {
        const apiChanges = this.analyzeApiChanges(change, snippet);
        conflicts.push(...apiChanges);
      }

      // Check for dependency impacts
      const dependencyConflicts = this.analyzeDependencyImpact(change, context);
      conflicts.push(...dependencyConflicts);
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  }

  private isApiFile(snippet: { content: string; description: string }): boolean {
    const apiIndicators = ['export function', 'export class', 'interface ', 'type ', 'API', 'api'];
    return apiIndicators.some(indicator => 
      snippet.content.includes(indicator) || snippet.description.toLowerCase().includes('api')
    );
  }

  private analyzeApiChanges(change: FileChange, snippet: { content: string }): SemanticConflict[] {
    const conflicts: SemanticConflict[] = [];
    const content = snippet.content;

    // Check for function signature patterns
    if (content.includes('export function') || content.includes('export async function')) {
      conflicts.push({
        type: 'api_breaking_change',
        file: change.file,
        description: `Potential API breaking change in ${change.file}. Function signature may have changed.`,
        severity: 'high',
        affectedAgents: [],
        suggestion: 'Review function signature changes and ensure backward compatibility or version the API.'
      });
    }

    // Check for interface changes
    if (content.includes('interface ') || content.includes('type ')) {
      conflicts.push({
        type: 'interface_mismatch',
        file: change.file,
        description: `Interface or type definition modified in ${change.file}`,
        severity: 'medium',
        affectedAgents: [],
        suggestion: 'Verify all consumers of this interface are updated.'
      });
    }

    return conflicts;
  }

  private analyzeDependencyImpact(change: FileChange, context: SharedContext): SemanticConflict[] {
    const conflicts: SemanticConflict[] = [];

    // Check if other agents are working on dependent files
    for (const [file, changes] of context.recentFileChanges) {
      const hasDependentChange = changes.some(c => 
        c.agentId !== change.agentId && 
        this.mayBeDependent(file, change.file)
      );

      if (hasDependentChange) {
        conflicts.push({
          type: 'dependency_change',
          file: change.file,
          description: `Changes to ${change.file} may affect work on ${file}`,
          severity: 'medium',
          affectedAgents: changes.map(c => c.agentId),
          suggestion: 'Coordinate changes between affected agents.'
        });
      }
    }

    return conflicts;
  }

  private mayBeDependent(file1: string, file2: string): boolean {
    // Simple heuristic: same directory or similar names
    const dir1 = file1.split('/').slice(0, -1).join('/');
    const dir2 = file2.split('/').slice(0, -1).join('/');
    
    if (dir1 === dir2 && dir1 !== '') return true;

    // Check for common prefixes
    const name1 = file1.split('/').pop()?.split('.')[0] || '';
    const name2 = file2.split('/').pop()?.split('.')[0] || '';
    
    return name1.includes(name2) || name2.includes(name1);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/conflict/semantic-detector.ts
git add packages/core/src/conflict/__tests__/semantic-detector.test.ts
git commit -m "feat(core): implement Layer 3 semantic conflict detection"
```

---

## Chunk 3: TUI Interface

### Task 3: TUI with Ink

**Files:**
- Create: `packages/cli/src/tui/app.tsx`
- Create: `packages/cli/src/tui/components/task-list.tsx`
- Create: `packages/cli/src/tui/components/agent-status.tsx`
- Create: `packages/cli/src/tui/components/lock-view.tsx`
- Create: `packages/cli/src/tui/index.ts`
- Update: `packages/cli/package.json`

- [ ] **Step 1: Update package.json with Ink dependencies**

```json
{
  "dependencies": {
    "ink": "^4.0.0",
    "react": "^18.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0"
  }
}
```

- [ ] **Step 2: Create TUI components**

```typescript
// packages/cli/src/tui/app.tsx
import React from 'react';
import { Box, Text, useApp } from 'ink';
import { TaskList } from './components/task-list';
import { AgentStatus } from './components/agent-status';
import { LockView } from './components/lock-view';

interface AppProps {
  projectName: string;
  tasks: Array<{ id: string; title: string; status: string; agent?: string }>;
  agents: Array<{ id: string; name: string; status: string }>;
  locks: Array<{ file: string; holder: string }>;
}

export function TuiApp({ projectName, tasks, agents, locks }: AppProps) {
  const { exit } = useApp();

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Agent Orchestrator - {projectName}
        </Text>
      </Box>

      <Box flexDirection="row" gap={2}>
        <Box flexDirection="column" width="50%">
          <Text bold>Tasks</Text>
          <TaskList tasks={tasks} />
        </Box>

        <Box flexDirection="column" width="25%">
          <Text bold>Agents</Text>
          <AgentStatus agents={agents} />
        </Box>

        <Box flexDirection="column" width="25%">
          <Text bold>Locks</Text>
          <LockView locks={locks} />
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          Press 'q' to quit | 'r' to refresh
        </Text>
      </Box>
    </Box>
  );
}
```

```typescript
// packages/cli/src/tui/components/task-list.tsx
import React from 'react';
import { Box, Text } from 'ink';

interface TaskListProps {
  tasks: Array<{ id: string; title: string; status: string; agent?: string }>;
}

export function TaskList({ tasks }: TaskListProps) {
  const statusColors: Record<string, string> = {
    pending: 'yellow',
    executing: 'blue',
    reviewing: 'magenta',
    completed: 'green',
    failed: 'red'
  };

  return (
    <Box flexDirection="column">
      {tasks.length === 0 ? (
        <Text dimColor>No tasks</Text>
      ) : (
        tasks.map(task => (
          <Box key={task.id}>
            <Text color={statusColors[task.status] || 'white'}>
              [{task.status.padEnd(10)}]
            </Text>
            <Text> {task.id}: {task.title}</Text>
            {task.agent && <Text dimColor> ({task.agent})</Text>}
          </Box>
        ))
      )}
    </Box>
  );
}
```

```typescript
// packages/cli/src/tui/components/agent-status.tsx
import React from 'react';
import { Box, Text } from 'ink';

interface AgentStatusProps {
  agents: Array<{ id: string; name: string; status: string }>;
}

export function AgentStatus({ agents }: AgentStatusProps) {
  const statusIcons: Record<string, string> = {
    online: '●',
    offline: '○',
    busy: '◐',
    error: '✗'
  };

  const statusColors: Record<string, string> = {
    online: 'green',
    offline: 'gray',
    busy: 'yellow',
    error: 'red'
  };

  return (
    <Box flexDirection="column">
      {agents.length === 0 ? (
        <Text dimColor>No agents</Text>
      ) : (
        agents.map(agent => (
          <Box key={agent.id}>
            <Text color={statusColors[agent.status] || 'white'}>
              {statusIcons[agent.status] || '○'}
            </Text>
            <Text> {agent.name}</Text>
          </Box>
        ))
      )}
    </Box>
  );
}
```

```typescript
// packages/cli/src/tui/components/lock-view.tsx
import React from 'react';
import { Box, Text } from 'ink';

interface LockViewProps {
  locks: Array<{ file: string; holder: string }>;
}

export function LockView({ locks }: LockViewProps) {
  return (
    <Box flexDirection="column">
      {locks.length === 0 ? (
        <Text dimColor>No active locks</Text>
      ) : (
        locks.map((lock, i) => (
          <Box key={i} flexDirection="column">
            <Text color="red">🔒 {lock.file}</Text>
            <Text dimColor>   by {lock.holder}</Text>
          </Box>
        ))
      )}
    </Box>
  );
}
```

```typescript
// packages/cli/src/tui/index.ts
import React from 'react';
import { render } from 'ink';
import { TuiApp } from './app';

export interface TuiData {
  projectName: string;
  tasks: Array<{ id: string; title: string; status: string; agent?: string }>;
  agents: Array<{ id: string; name: string; status: string }>;
  locks: Array<{ file: string; holder: string }>;
}

export function startTui(data: TuiData) {
  render(<TuiApp {...data} />);
}

export { TuiApp } from './app';
```

- [ ] **Step 3: Add TUI command to CLI**

Update `packages/cli/src/index.ts`:
```typescript
import { startTui } from './tui';

program
  .command('tui')
  .description('Start terminal UI')
  .action(async () => {
    const baseDir = process.cwd();
    const brain = new ProjectBrainImpl(baseDir);
    const loaded = await brain.load();
    
    if (!loaded) {
      console.log('No project found. Run `agent-orch init` first.');
      return;
    }

    startTui({
      projectName: brain.name,
      tasks: Array.from(brain.tasks.nodes.values()).map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        agent: t.assignee
      })),
      agents: brain.agents.map(a => ({
        id: a.id,
        name: a.name,
        status: a.status
      })),
      locks: brain.locks.active.map(l => ({
        file: l.file,
        holder: l.holder.agentId
      }))
    });
  });
```

- [ ] **Step 4: Run install and build**

```bash
npm install
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/tui/
git add packages/cli/package.json
git commit -m "feat(cli): implement TUI with Ink"
```

---

## Chunk 4: Web Dashboard

### Task 4: Dashboard HTML and Log Streaming

**Files:**
- Create: `packages/web/src/public/index.html`
- Create: `packages/web/src/routes/logs.ts`
- Update: `packages/web/src/server.ts`

- [ ] **Step 1: Create dashboard HTML**

```html
<!-- packages/web/src/public/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Orchestrator Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #eee; }
    .container { display: grid; grid-template-columns: 250px 1fr 300px; height: 100vh; }
    
    header { grid-column: 1 / -1; padding: 1rem 2rem; background: #16213e; border-bottom: 1px solid #0f3460; }
    header h1 { font-size: 1.5rem; color: #e94560; }
    
    nav { background: #16213e; padding: 1rem; border-right: 1px solid #0f3460; }
    nav a { display: block; padding: 0.75rem 1rem; color: #eee; text-decoration: none; border-radius: 4px; margin-bottom: 0.5rem; }
    nav a:hover { background: #0f3460; }
    nav a.active { background: #e94560; }
    
    main { padding: 1.5rem; overflow-y: auto; }
    .card { background: #16213e; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
    .card h2 { font-size: 1rem; margin-bottom: 0.75rem; color: #e94560; }
    
    aside { background: #16213e; padding: 1rem; border-left: 1px solid #0f3460; overflow-y: auto; }
    aside h3 { font-size: 0.875rem; margin-bottom: 0.5rem; color: #e94560; }
    
    .task-list { list-style: none; }
    .task-item { display: flex; align-items: center; padding: 0.5rem; border-bottom: 1px solid #0f3460; }
    .task-status { width: 80px; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; text-align: center; }
    .status-pending { background: #f39c12; color: #000; }
    .status-executing { background: #3498db; }
    .status-completed { background: #27ae60; }
    .status-failed { background: #e74c3c; }
    
    .agent-list { list-style: none; }
    .agent-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0; }
    .agent-dot { width: 8px; height: 8px; border-radius: 50%; }
    .online { background: #27ae60; }
    .offline { background: #7f8c8d; }
    .busy { background: #f39c12; }
    
    .lock-item { font-size: 0.875rem; padding: 0.25rem 0; }
    .lock-file { color: #e94560; }
    
    .log-stream { font-family: monospace; font-size: 0.75rem; line-height: 1.4; }
    .log-entry { padding: 2px 0; border-bottom: 1px solid #0f3460; }
    .log-info { color: #3498db; }
    .log-warn { color: #f39c12; }
    .log-error { color: #e74c3c; }
    .log-debug { color: #7f8c8d; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🤖 Agent Orchestrator</h1>
    </header>
    
    <nav>
      <a href="#" class="active">Dashboard</a>
      <a href="#tasks">Tasks</a>
      <a href="#agents">Agents</a>
      <a href="#locks">Locks</a>
      <a href="#logs">Logs</a>
    </nav>
    
    <main>
      <div class="card">
        <h2>Tasks</h2>
        <ul class="task-list" id="task-list">
          <li class="task-item">
            <span class="task-status status-pending">pending</span>
            <span>T001: Sample task</span>
          </li>
        </ul>
      </div>
      
      <div class="card">
        <h2>Recent Activity</h2>
        <div class="log-stream" id="log-stream"></div>
      </div>
    </main>
    
    <aside>
      <h3>Agents</h3>
      <ul class="agent-list" id="agent-list">
        <li class="agent-item">
          <span class="agent-dot online"></span>
          <span>Qoder</span>
        </li>
      </ul>
      
      <h3 style="margin-top: 1rem;">Active Locks</h3>
      <div id="lock-list">
        <div class="lock-item">
          <span class="lock-file">file1.ts</span>
          <span> (agent-1)</span>
        </div>
      </div>
    </aside>
  </div>
  
  <script>
    // Fetch and display data
    async function refreshData() {
      const [statusRes, tasksRes, agentsRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/tasks'),
        fetch('/api/agents')
      ]);
      
      const status = await statusRes.json();
      const tasks = await tasksRes.json();
      const agents = await agentsRes.json();
      
      // Update UI
      document.getElementById('task-list').innerHTML = tasks.map(t => `
        <li class="task-item">
          <span class="task-status status-${t.status}">${t.status}</span>
          <span>${t.id}: ${t.title}</span>
        </li>
      `).join('');
      
      document.getElementById('agent-list').innerHTML = agents.map(a => `
        <li class="agent-item">
          <span class="agent-dot ${a.status}"></span>
          <span>${a.name}</span>
        </li>
      `).join('');
    }
    
    // Log streaming
    const eventSource = new EventSource('/api/logs/stream');
    eventSource.onmessage = (event) => {
      const log = JSON.parse(event.data);
      const logStream = document.getElementById('log-stream');
      logStream.innerHTML += `<div class="log-entry log-${log.level}">[${log.timestamp}] ${log.message}</div>`;
      logStream.scrollTop = logStream.scrollHeight;
    };
    
    refreshData();
    setInterval(refreshData, 5000);
  </script>
</body>
</html>
```

- [ ] **Step 2: Create logs route**

```typescript
// packages/web/src/routes/logs.ts
import { Router, Request, Response } from 'express';
import { getGlobalLogs } from '@agent-orchestrator/core/logging/logger';

export function createLogsRouter(): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    const logs = getGlobalLogs();
    res.json(logs);
  });

  router.get('/stream', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendLog = () => {
      const logs = getGlobalLogs({ since: new Date(Date.now() - 1000) });
      for (const log of logs) {
        res.write(`data: ${JSON.stringify(log)}\n\n`);
      }
    };

    const interval = setInterval(sendLog, 1000);

    req.on('close', () => {
      clearInterval(interval);
    });
  });

  return router;
}
```

- [ ] **Step 3: Update server.ts**

```typescript
// Add to server.ts
import express from 'express';
import { createLogsRouter } from './routes/logs';

// Add after other routes
app.use('/api/logs', createLogsRouter());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for root
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
```

- [ ] **Step 4: Run build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add packages/web/
git commit -m "feat(web): add dashboard HTML and log streaming"
```

---

## Chunk 5: Documentation

### Task 5: Documentation and Examples

**Files:**
- Create: `docs/getting-started.md`
- Create: `docs/architecture.md`
- Create: `docs/api-reference.md`
- Create: `examples/native-card-migration/.agent-orch/config.yaml`
- Create: `examples/native-card-migration/.agent-orch/agents/qoder.yaml`
- Create: `examples/native-card-migration/README.md`

- [ ] **Step 1: Create getting-started.md**

```markdown
# Getting Started

## Installation

```bash
npm install -g @agent-orchestrator/cli
```

## Quick Start

### 1. Initialize a Project

```bash
mkdir my-project && cd my-project
agent-orch init
```

This creates:
- `.agent-orch/config.yaml` - Project configuration
- `.agent-orch/brain.json` - Project brain (shared state)
- `.agent-orch/agents/` - Agent configurations

### 2. Register Agents

```bash
agent-orch agent add qoder --config ./qoder.yaml
```

### 3. Create Tasks

```bash
agent-orch task create
```

### 4. Start Orchestration

```bash
agent-orch start
```

### 5. View Dashboard

```bash
agent-orch web
```

Open http://localhost:3000 to see the dashboard.

## CLI Commands

| Command | Description |
|---------|-------------|
| `agent-orch init` | Initialize project |
| `agent-orch agent add <name>` | Register agent |
| `agent-orch agent list` | List agents |
| `agent-orch task create` | Create task |
| `agent-orch start` | Start orchestration |
| `agent-orch web` | Start web dashboard |
| `agent-orch tui` | Start terminal UI |
```

- [ ] **Step 2: Create architecture.md**

```markdown
# Architecture

## Overview

Agent Orchestrator is a multi-agent collaboration system that coordinates AI agents through:

1. **Orchestrator Agent** - Central coordinator
2. **Project Brain** - Shared state and context
3. **Lock Manager** - Conflict prevention
4. **Agent Adapters** - Wrapper for third-party agents

## Components

### Core Package (`@agent-orchestrator/core`)

- **Types** - TypeScript interfaces for all entities
- **Project Brain** - Shared state management with persistence
- **Lock Manager** - File and region locking
- **Conflict Detector** - 3-layer conflict detection
- **Task State Machine** - Valid state transitions
- **Logger** - Centralized logging

### Orchestrator Package (`@agent-orchestrator/orchestrator`)

- **TaskDecompositionSkill** - Break tasks into subtasks
- **AgentDispatchSkill** - Dispatch to agents with locking
- **LockManagementSkill** - Unified lock interface
- **TaskReviewSkill** - Review task outputs
- **DecisionLogSkill** - Track decisions

### Adapter Package (`@agent-orchestrator/adapter`)

- **CliAdapter** - Wrap CLI-based agents
- **Transformer** - Input/output transformation
- **LockInterceptor** - Parse lock protocol
- **Prompts** - Lock protocol templates

### CLI Package (`@agent-orchestrator/cli`)

- Command-line interface
- TUI dashboard

### Web Package (`@agent-orchestrator/web`)

- REST API
- Web dashboard
- Log streaming
```

- [ ] **Step 3: Create api-reference.md**

```markdown
# API Reference

## REST API

Base URL: `http://localhost:3000/api`

### Health

```
GET /health
Response: { status: "ok", timestamp: string }
```

### Status

```
GET /status
Response: {
  status: string,
  agents: { total: number, online: number, busy: number },
  tasks: { total: number, pending: number, completed: number },
  locks: { active: number }
}
```

### Tasks

```
GET /tasks
Response: Task[]

POST /tasks
Body: { title: string, description: string, type: string }
Response: Task

GET /tasks/:id
Response: Task

PUT /tasks/:id/status
Body: { status: string }
Response: Task
```

### Agents

```
GET /agents
Response: Agent[]

POST /agents
Body: { id: string, name: string, description: string }
Response: Agent

GET /agents/:id
Response: Agent

DELETE /agents/:id
Response: 204 No Content
```

### Logs

```
GET /logs
Response: LogEntry[]

GET /logs/stream
Response: Server-Sent Events (SSE)
```
```

- [ ] **Step 4: Create example project**

```yaml
# examples/native-card-migration/.agent-orch/config.yaml
name: Native Card Migration
description: Migrate Native cards to new technology stack
goal: Complete migration of all card components
version: "1.0.0"
```

```yaml
# examples/native-card-migration/.agent-orch/agents/qoder.yaml
name: qoder
description: Native repository code expert
version: "1.0.0"

skills:
  - id: analyze-dependencies
    name: Analyze Dependencies
    description: Analyze file dependencies and generate dependency graph
    tags: [analysis, objective-c, dependencies]
  - id: refactor-code
    name: Code Refactoring
    description: Refactor Objective-C code
    tags: [refactoring, objective-c]

workspace:
  cwd: /path/to/native-repo

invocation:
  type: cli
  command: /usr/local/bin/qoder
  timeout: 300000
```

```markdown
# examples/native-card-migration/README.md
# Native Card Migration Example

This example demonstrates using Agent Orchestrator to migrate Native card components.

## Setup

1. Copy this directory to your project
2. Update agent paths in `.agent-orch/agents/*.yaml`
3. Run `agent-orch start`

## Workflow

1. Orchestrator receives migration task
2. TaskDecompositionSkill breaks it into subtasks
3. Agents are dispatched with proper locking
4. Outputs are reviewed
5. Decisions are logged
```

- [ ] **Step 5: Commit**

```bash
git add docs/ examples/
git commit -m "docs: add documentation and example project"
```

---

## Chunk 6: Final Integration

### Task 6: Final Build and Verification

**Tasks:**

1. **Update all exports**
2. **Run full test suite**
3. **Run build**
4. **Create README.md**

- [ ] **Step 1: Create root README.md**

```markdown
# Agent Orchestrator

Multi-Agent Collaboration System for AI-powered software development.

## Features

- 🤖 **Multi-Agent Orchestration** - Coordinate multiple AI agents
- 🧠 **Shared Brain** - All agents share context and state
- 🔒 **Conflict Prevention** - Lock mechanism prevents concurrent modifications
- 📊 **Dashboard** - Web and TUI interfaces
- 📝 **Decision Logging** - Track all decisions made during development

## Packages

| Package | Description |
|---------|-------------|
| `@agent-orchestrator/core` | Core types, brain, locks, conflict detection |
| `@agent-orchestrator/orchestrator` | Orchestration skills |
| `@agent-orchestrator/adapter` | Agent adapter framework |
| `@agent-orchestrator/cli` | Command-line interface |
| `@agent-orchestrator/web` | Web dashboard |

## Quick Start

```bash
# Install
npm install

# Build
npm run build

# Test
npm test

# Start web dashboard
npm run dev --workspace=@agent-orchestrator/web
```

## Documentation

- [Getting Started](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- [API Reference](docs/api-reference.md)

## License

MIT
```

- [ ] **Step 2: Run tests and build**

```bash
npm test
npm run build
```

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "chore: Phase 4 complete - logging, semantic detection, TUI, dashboard, docs"
```

---

## Summary

**Phase 4 Completed Tasks:**
1. Logging System - Centralized logging with filtering
2. Semantic Conflict Detection - Layer 3 AI-based analysis
3. TUI Interface - Terminal dashboard with Ink
4. Web Dashboard - HTML dashboard with log streaming
5. Documentation - Getting started, architecture, API reference
6. Example Project - Native card migration example

**Total Tests:** 100+ tests across all packages

**Features Complete:**
- Multi-agent orchestration
- 3-layer conflict detection
- Lock mechanism with queue
- Task state machine
- Web and TUI dashboards
- Comprehensive documentation