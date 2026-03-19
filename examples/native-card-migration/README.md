# Native Card Migration Example

This example demonstrates how to use Agent Orchestrator for migrating Native Card components from Objective-C to SwiftUI.

## Project Overview

This project showcases a multi-agent collaboration scenario where:

1. **Qoder** analyzes the native Objective-C codebase
2. **Codex** implements new SwiftUI components
3. **iFlow** handles integration and testing

## Setup

### Prerequisites

- Node.js 18+
- Access to both native and new repositories
- CLI agents installed (qoder, codex)

### Initialize the Project

```bash
# Navigate to your project directory
cd /path/to/your-project

# Initialize Agent Orchestrator
agent-orch init

# Copy the example configuration
cp -r /path/to/examples/native-card-migration/.agent-orch ./
```

### Configure Agents

1. **Edit `config.yaml`** with your repository paths:

```yaml
project:
  nativeRepo: /actual/path/to/native-repo
  newRepo: /actual/path/to/new-repo
```

2. **Edit `agents/qoder.yaml`** with correct paths:

```yaml
cwd: /actual/path/to/native-repo
env:
  WORKSPACE: /actual/path/to/native-repo
```

3. **Add additional agents**:

```bash
# Add codex for Swift implementation
agent-orch agent add codex --config ./agents/codex.yaml

# Add iflow for integration testing
agent-orch agent add iflow --config ./agents/iflow.yaml
```

### Register Agents

```bash
# List registered agents
agent-orch agent list

# Output:
# - qoder: Native code expert specializing in Objective-C analysis
# - codex: Swift/SwiftUI implementation specialist
# - iflow: Integration and testing coordinator
```

## Workflow

### 1. Create Migration Tasks

```bash
agent-orch task create
```

Example task structure:

```
T001: Analyze CardTableViewCell dependencies
  └── T002: Design SwiftUI CardViewModel
        └── T003: Implement CardViewModel
              └── T004: Write unit tests
```

### 2. Start Orchestration

```bash
# Start the orchestration system
agent-orch start

# Or launch the TUI for interactive monitoring
agent-orch tui
```

### 3. Monitor Progress

Use the web dashboard for comprehensive monitoring:

```bash
agent-orch web
```

Open `http://localhost:3000` to see:
- Task kanban board
- Agent status
- File lock visualization
- Real-time logs

## Task Example

### Creating a Migration Task

```bash
$ agent-orch task create
? Task title: Migrate CardTableViewCell to SwiftUI
? Description: Migrate the CardTableViewCell Objective-C class to SwiftUI CardView
? Output type: code
? Acceptance criteria (comma-separated): Preserves all visual elements, Handles all data bindings, Includes unit tests
? Priority: high
✓ Task T005 created
```

### Task Assignment

The orchestrator automatically assigns tasks based on agent skills:

| Task Type | Assigned Agent |
|-----------|---------------|
| Objective-C analysis | qoder |
| Swift implementation | codex |
| Integration testing | iflow |

## Lock Protocol

Agents use the lock protocol to prevent conflicts:

```
# Agent declares intent
[DECLARE] I will modify: CardViewModel.swift, CardViewModelTests.swift

# System confirms
[LOCK GRANTED] CardViewModel.swift, CardViewModelTests.swift

# Agent releases after completion
[RELEASE] CardViewModel.swift, CardViewModelTests.swift
```

## File Structure

```
native-card-migration/
├── .agent-orch/
│   ├── config.yaml          # Project configuration
│   ├── brain.json           # Shared project state
│   └── agents/
│       ├── qoder.yaml       # Qoder agent config
│       ├── codex.yaml       # Codex agent config
│       └── iflow.yaml       # iFlow agent config
├── native-repo/             # Original Objective-C code
│   └── CardTableViewCell.m
└── new-repo/                # New SwiftUI code
    └── CardView.swift
```

## Troubleshooting

### Agent Not Responding

```bash
# Check agent status
agent-orch agent status qoder

# Test agent connection
agent-orch agent test qoder
```

### Lock Not Released

```bash
# View active locks
agent-orch lock list

# Manually release a lock (admin)
agent-orch lock release <lock-id>
```

### Task Blocked

Check the task dependencies and lock status:

```bash
agent-orch task show T005
agent-orch lock list
```

## Best Practices

1. **Start with analysis tasks** - Have qoder analyze dependencies before implementation
2. **Use clear acceptance criteria** - Help agents understand expectations
3. **Monitor file locks** - Avoid conflicts by watching the lock dashboard
4. **Review decisions** - Check the decision log for architectural choices
5. **Test frequently** - Run tests after each major task completion