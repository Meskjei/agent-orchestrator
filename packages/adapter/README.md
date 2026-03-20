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

## CLI Adapter

The `CliAdapter` provides a simple way to execute CLI commands and capture output.

```typescript
import { CliAdapter } from '@agent-orchestrator/adapter';

const adapter = new CliAdapter({
  command: 'node',
  args: ['script.js']
});

const result = await adapter.execute({ task: 'run', context: {} });
```