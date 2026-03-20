# Architecture

This document describes the architecture of the Agent Orchestrator system.

## System Overview

```
                                     ┌─────────────────────────────────┐
                                     │         Human User              │
                                     │  (Task Publisher / Approver)    │
                                     └───────────────┬─────────────────┘
                                                     │
                               ┌─────────────────────┼─────────────────────┐
                               │                     │                     │
                               ▼                     ▼                     ▼
                        ┌──────────┐          ┌──────────┐         ┌──────────┐
                        │   CLI    │          │   Web    │         │   API    │
                        │Interface │          │Dashboard │         │ Server   │
                        └────┬─────┘          └────┬─────┘         └────┬─────┘
                             │                     │                    │
                             └─────────────────────┼────────────────────┘
                                                   │
                                                   ▼
                               ┌───────────────────────────────────────┐
                               │         Orchestrator Agent            │
                               │                                       │
                               │  ┌─────────────────────────────────┐  │
                               │  │       Orchestrator Skills       │  │
                               │  │  - TaskDecompositionSkill       │  │
                               │  │  - AgentDispatchSkill           │  │
                               │  │  - LockManagementSkill          │  │
                               │  │  - TaskReviewSkill              │  │
                               │  │  - DecisionLogSkill             │  │
                               │  └─────────────────────────────────┘  │
                               └───────────────────┬───────────────────┘
                                                   │
                               ┌───────────────────┼───────────────────┐
                               │                   │                   │
                               ▼                   ▼                   ▼
                     ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
                     │  Project Brain  │  │  Lock Manager   │  │  Agent Adapters │
                     │  (Shared State) │  │  (Lock Service) │  │  (CLI/API Wraps)│
                     └─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Core Components

### Project Brain

The **Project Brain** is the shared cognition layer that maintains:

- **Goal**: Project objectives and success criteria
- **Agents**: Registered agents and their capabilities
- **Tasks**: Hierarchical task tree with status tracking
- **Context**: Shared code snippets, outputs, and pending questions
- **Decisions**: Record of all decisions made during the project
- **Locks**: Active file locks and history

### Lock Manager

The **Lock Manager** prevents concurrent modification conflicts:

- File-level and region-level locking
- Exclusive and shared lock types
- Automatic lock expiration (30-minute default)
- Waiting queue for lock requests

### Agent Adapters

**Agent Adapters** wrap third-party agents (CLI tools, APIs) to provide a unified interface:

- **CliAdapter**: Wrap CLI-based agents with stdin/stdout communication
- **ACPClientAdapter**: Communicate with ACP-compatible agents (opencode, claude code) via JSON-RPC
- Input transformation (context → agent prompt)
- Output parsing (agent response → structured output)
- Lock protocol enforcement via prompt injection

#### ACP Protocol

The ACP (Agent Client Protocol) adapter enables communication with real AI agents:

```
┌──────────────────────────────────────────────────────────────┐
│                    Agent Orchestrator                        │
│                                                              │
│  ┌─────────────────┐    ┌─────────────────────────────────┐  │
│  │ ACPClientAdapter │───►│  opencode acp (subprocess)      │  │
│  │                 │    │  JSON-RPC over stdio             │  │
│  │ - initialize()  │    │  - Session management            │  │
│  │ - newSession()  │    │  - Prompt execution              │  │
│  │ - prompt()      │    │  - Tool call handling            │  │
│  └─────────────────┘    └─────────────────────────────────┘  │
│                                                              │
│  Features:                                                   │
│  - Lock protocol prompt injection                            │
│  - Timeout handling                                          │
│  - Concurrent agent support                                   │
│  - Tool call tracking                                        │
└──────────────────────────────────────────────────────────────┘
```

## Packages

The system is organized into five packages:

### `@agent-orchestrator/core`

Core types and utilities:

| Module | Purpose |
|--------|---------|
| `types` | Type definitions for Task, Agent, Lock, Brain |
| `brain` | ProjectBrain implementation with persistence |
| `lock/manager` | Lock acquisition, release, and query |
| `conflict/detector` | Path, region, and semantic conflict detection |
| `task/state-machine` | Task status transitions |
| `logging` | Structured logging with filtering |

### `@agent-orchestrator/orchestrator`

Orchestration skills:

| Skill | Purpose |
|-------|---------|
| `TaskDecompositionSkill` | Break down complex tasks into subtasks |
| `AgentDispatchSkill` | Dispatch tasks to agents with lock handling |
| `LockManagementSkill` | Manage file locks for agents |
| `TaskReviewSkill` | Review task outputs against specifications |
| `DecisionLogSkill` | Record and query project decisions |

### `@agent-orchestrator/adapter`

Agent adapter infrastructure:

| Module | Purpose |
|--------|---------|
| `CliAdapter` | Wrap CLI-based agents |
| `ACPClientAdapter` | Communicate with ACP-compatible agents (opencode, claude code) |
| `ACPConnectionPool` | Manage reusable subprocess connections |
| `Transformer` | Transform input/output for agents |
| `LockInterceptor` | Parse and enforce lock protocol in agent output |
| `prompts/lock-protocol` | Generate lock protocol prompts |
| `acp/tools/lock-tools` | MCP lock tools for agent integration |

### `@agent-orchestrator/cli`

Command-line interface:

| Command | Purpose |
|---------|---------|
| `init` | Initialize project structure |
| `agent add/list` | Manage agents |
| `task create` | Create tasks |
| `start` | Start orchestration |
| `tui` | Launch terminal UI |

### `@agent-orchestrator/web`

Web dashboard server:

| Route | Purpose |
|-------|---------|
| `/api/tasks` | Task CRUD operations |
| `/api/agents` | Agent management |
| `/api/status` | Project status |
| `/api/logs` | Log streaming (SSE) |

## Skills

### TaskDecompositionSkill

Decomposes complex tasks into manageable subtasks:

```typescript
const result = await skill.execute({
  taskDescription: "Migrate CardTableViewCell to SwiftUI",
  goal: "Complete migration preserving functionality",
  constraints: ["No breaking changes", "Maintain tests"],
  availableAgents: brain.agents
});
// Returns: { subtasks, dependencies, assignments }
```

### AgentDispatchSkill

Dispatches tasks to agents with automatic lock management:

```typescript
const result = await skill.execute({
  agentId: "qoder",
  task: taskNode,
  context: {
    projectGoal: "Migrate to SwiftUI",
    agentRole: "iOS Developer",
    relevantCodeSnippets: [...],
    currentLocks: [...]
  }
});
// Returns: { status, output, locksAcquired, locksReleased }
```

### LockManagementSkill

Manages file locks for conflict prevention:

```typescript
// Acquire locks
await skill.execute({
  action: 'acquire',
  agentId: 'codex',
  taskId: 'T001',
  files: ['CardViewModel.swift']
});

// Release locks
await skill.execute({
  action: 'release',
  agentId: 'codex',
  files: ['CardViewModel.swift']
});
```

### TaskReviewSkill

Reviews task outputs for specification compliance:

```typescript
const report = await skill.execute({
  task: taskNode,
  output: { summary, files, artifacts },
  reviewType: 'both'  // spec + quality
});
// Returns: { passed, specReview, qualityReview, requiresHumanReview }
```

### DecisionLogSkill

Records and queries project decisions:

```typescript
await skill.execute({
  action: 'record',
  decision: {
    decision: "Use SwiftUI for UI layer",
    decider: "human",
    context: "Architecture review",
    alternatives: ["UIKit", "React Native"],
    impact: ["All UI components", "Testing strategy"]
  }
});
```

## Lock Mechanism

### How It Works

1. **Declaration**: Agent declares intent to modify files via `[DECLARE]` in output
2. **Acquisition**: Lock manager checks for conflicts and grants/denies
3. **Execution**: Agent proceeds with modifications if lock granted
4. **Release**: Agent releases locks via `[RELEASE]` when done

### Lock States

```
┌─────────────┐     Acquire      ┌─────────────┐
│   Pending   │ ──────────────►  │   Active    │
└─────────────┘                  └──────┬──────┘
                                        │
                       Release/Expire   │
                              │         │
                              ▼         ▼
                        ┌─────────────┐
                        │  Released   │
                        └─────────────┘
```

### Conflict Detection Layers

| Layer | Detection | Resolution |
|-------|-----------|------------|
| Path | Same file modification | Lock blocks access |
| Region | Overlapping code regions | Region lock or merge |
| Semantic | Logical dependencies | Alert for human review |

## Task State Machine

```
                ┌─────────────┐
                │   pending   │
                └──────┬──────┘
                       │ Dependencies met
                       ▼
                ┌─────────────┐
      ┌────────│    ready    │◄───────┐
      │        └──────┬──────┘        │
      │               │ Assign        │ Reassign
      │               ▼               │
      │        ┌─────────────┐        │
      │        │   assigned  │────────┘
      │        └──────┬──────┘
      │               │ Start
      │               ▼
      │        ┌─────────────┐
      │        │  executing  │◄───────┐
      │        └──────┬──────┘        │
      │               │ Complete      │ Needs info
      │               ▼               │
      │        ┌─────────────┐        │
      │        │  reviewing  │────────┘
      │        └──────┬──────┘
      │               │
      │       ┌───────┴───────┐
      │       ▼               ▼
      │ ┌──────────┐   ┌───────────┐
      │ │ revision │   │ completed │
      │ └────┬─────┘   └───────────┘
      │      │ Resubmit
      │      └──────────────► reviewing
      │
      │ Block
      ▼
 ┌─────────────┐
 │   blocked   │
 └─────────────┘
```

## Data Persistence

All project state is persisted to `.agent-orch/brain.json`:

```json
{
  "id": "uuid",
  "name": "Project Name",
  "version": "1.0.0",
  "goal": { "description": "...", "successCriteria": [], "constraints": [] },
  "agents": [...],
  "tasks": { "root": "...", "nodes": [...] },
  "context": { "background": "...", "codeSnippets": [], "outputs": [] },
  "decisions": [...],
  "locks": { "active": [], "history": [] }
}
```