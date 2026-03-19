# Getting Started

This guide will help you get up and running with Agent Orchestrator.

## Installation

### Prerequisites

- Node.js 18+
- npm 10+

### Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd Agent-Communication

# Install dependencies
npm install

# Build all packages
npm run build
```

### Global CLI (Optional)

```bash
# Link CLI globally
cd packages/cli
npm link
```

## Quick Start

### 1. Initialize a Project

```bash
# Navigate to your project directory
cd /path/to/your-project

# Initialize Agent Orchestrator
agent-orch init
```

This creates:
- `.agent-orch/config.yaml` - Project configuration
- `.agent-orch/brain.json` - Shared project state
- `.agent-orch/agents/` - Agent configurations directory

### 2. Register Agents

```bash
# Add an agent interactively
agent-orch agent add qoder

# Add an agent from config file
agent-orch agent add codex --config ./codex-config.yaml
```

### 3. Create Tasks

```bash
# Create a task interactively
agent-orch task create
```

### 4. Start Orchestration

```bash
# Start the orchestration system
agent-orch start

# Launch the Terminal UI
agent-orch tui
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `agent-orch init` | Initialize project with `.agent-orch/` directory |
| `agent-orch agent add <name>` | Register a new agent |
| `agent-orch agent add <name> -c <path>` | Register agent from config file |
| `agent-orch agent list` | List all registered agents |
| `agent-orch task create` | Create a new task |
| `agent-orch start` | Start orchestration |
| `agent-orch tui` | Launch terminal user interface |
| `agent-orch web` | Start web dashboard |

## Web Dashboard

Start the web dashboard to monitor and manage your multi-agent collaboration:

```bash
agent-orch web
```

The dashboard provides:

- **Project Overview**: Goals, progress, and key metrics
- **Task Kanban**: Visual task board with drag-and-drop support
- **Agent Status**: Real-time agent status and activity
- **File Locks**: Visual representation of locked files
- **Decision Log**: Timeline of all decisions made
- **Log Viewer**: Real-time log streaming

### Dashboard Features

| Feature | Description |
|---------|-------------|
| Task Board | Kanban-style view of all tasks by status |
| Agent Monitor | See which agents are online, busy, or offline |
| Lock Visualization | Tree view of files with lock status indicators |
| Real-time Logs | WebSocket-powered live log streaming |
| Decision Timeline | Chronological view of project decisions |

## Configuration

### Project Config (`config.yaml`)

```yaml
name: My Project
description: Project description
goal: Complete project objectives
version: "1.0.0"
```

### Agent Config (`agents/<name>.yaml`)

```yaml
name: agent-name
description: Agent capabilities description
type: cli  # or 'api'
command: /path/to/agent-binary
cwd: /path/to/workspace
skills:
  - skill-id-1
  - skill-id-2
```

## Next Steps

- Read the [Architecture Guide](./architecture.md) to understand the system design
- Check the [API Reference](./api-reference.md) for REST API details
- Explore the [Native Card Migration Example](../examples/native-card-migration/)