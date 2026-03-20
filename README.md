# Agent Orchestrator

Multi-Agent Collaboration System for AI-powered software development.

## Features

- 🤖 Multi-Agent Orchestration
- 🧠 Shared Brain
- 🔒 Conflict Prevention
- 📊 Dashboard (Web + TUI)
- 📝 Decision Logging
- 🔌 ACP Protocol Support (opencode, claude code)

## Packages

| Package | Description |
|---------|-------------|
| @agent-orchestrator/core | Core types, brain, locks, conflict detection |
| @agent-orchestrator/orchestrator | Orchestration skills |
| @agent-orchestrator/adapter | Agent adapters (CLI, ACP) |
| @agent-orchestrator/cli | CLI commands and TUI |
| @agent-orchestrator/web | Web dashboard and API |

## Quick Start

```bash
npm install
npm run build
npm test
```

## ACP Client Adapter

Communicate with real AI agents via Agent Client Protocol:

```typescript
import { ACPClientAdapter } from '@agent-orchestrator/adapter';

const adapter = new ACPClientAdapter({
  name: 'opencode',
  command: 'opencode',
  args: ['acp'],
  cwd: '/path/to/project',
  timeout: 90000
});

const result = await adapter.execute({
  task: 'Add a multiply function to math.js',
  context: {}
});

console.log(result.output);
console.log('Locks acquired:', result.locksAcquired);
```

### Supported Agents

| Agent | Command | Status |
|-------|---------|--------|
| opencode | `opencode acp` | ✅ Verified |
| claude code | `claude acp` | 🧪 Experimental |

## Documentation

- [Getting Started](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- [API Reference](docs/api-reference.md)

## Testing

```bash
# Unit tests
npm test

# E2E tests (requires opencode installed)
npm run test:e2e

# ACP integration tests
npm run test:acp
```

## License

MIT