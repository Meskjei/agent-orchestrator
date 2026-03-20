# API Reference

This document describes the REST API endpoints and programmatic APIs provided by Agent Orchestrator.

## REST API

### Base URL

```
http://localhost:3000/api
```

## Authentication

Most endpoints require authentication via Bearer token:

```
Authorization: Bearer <token>
```

Public endpoints (no auth required):
- `GET /api/health`
- `GET /api/status`

## Endpoints

### Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### Project Status

```http
GET /api/status
```

**Response:**
```json
{
  "status": "running",
  "agents": 4,
  "tasks": 20,
  "locks": 2,
  "project": {
    "id": "uuid",
    "name": "Native Card Migration",
    "version": "1.0.0"
  }
}
```

---

### Tasks

#### List All Tasks

```http
GET /api/tasks
```

**Response:**
```json
[
  {
    "id": "T001",
    "title": "Analyze CardTableViewCell dependencies",
    "description": "Analyze the dependencies of CardTableViewCell",
    "type": "task",
    "status": "executing",
    "assignee": "qoder",
    "dependencies": [],
    "estimatedFiles": ["CardTableViewCell.m", "CardTableViewCell.h"],
    "expectedOutput": {
      "type": "document",
      "description": "Dependency analysis document",
      "acceptanceCriteria": ["List all dependencies", "Generate dependency graph"]
    },
    "statusHistory": [
      { "status": "pending", "changedAt": "2024-01-15T09:00:00.000Z", "changedBy": "cli" },
      { "status": "assigned", "changedAt": "2024-01-15T09:05:00.000Z", "changedBy": "orchestrator" },
      { "status": "executing", "changedAt": "2024-01-15T09:10:00.000Z", "changedBy": "qoder" }
    ]
  }
]
```

#### Get Task by ID

```http
GET /api/tasks/:id
```

**Response:** Single task object (see above)

**Error Response (404):**
```json
{
  "error": "Task not found"
}
```

#### Create Task

```http
POST /api/tasks
Content-Type: application/json

{
  "id": "T002",
  "title": "Implement CardViewModel",
  "description": "Implement SwiftUI CardViewModel",
  "type": "task",
  "status": "pending",
  "dependencies": ["T001"],
  "estimatedFiles": ["CardViewModel.swift"],
  "expectedOutput": {
    "type": "code",
    "description": "SwiftUI CardViewModel implementation",
    "acceptanceCriteria": ["Follows MVVM pattern", "Includes unit tests"]
  }
}
```

**Response (201):**
```json
{
  "id": "T002",
  "title": "Implement CardViewModel",
  ...
}
```

**Error Response (400):**
```json
{
  "error": "Task id and title are required"
}
```

#### Update Task Status

```http
PUT /api/tasks/:id/status
Content-Type: application/json

{
  "status": "completed",
  "changedBy": "qoder",
  "reason": "All acceptance criteria met"
}
```

**Response:**
```json
{
  "id": "T001",
  "status": "completed",
  "statusHistory": [
    ...previous history,
    { "status": "completed", "changedAt": "2024-01-15T10:00:00.000Z", "changedBy": "qoder", "reason": "All acceptance criteria met" }
  ]
}
```

---

### Agents

#### List All Agents

```http
GET /api/agents
```

**Response:**
```json
[
  {
    "id": "qoder",
    "name": "Qoder",
    "description": "Native code expert for Objective-C analysis",
    "status": "online",
    "workingDirectory": "/path/to/native-repo",
    "skills": [
      { "id": "analyze-dependencies", "name": "Analyze Dependencies", "tags": ["analysis", "objc"] },
      { "id": "refactor-code", "name": "Refactor Code", "tags": ["refactoring", "objc"] }
    ],
    "currentTask": "T001"
  }
]
```

#### Get Agent by ID

```http
GET /api/agents/:id
```

**Response:** Single agent object (see above)

**Error Response (404):**
```json
{
  "error": "Agent not found"
}
```

#### Register Agent

```http
POST /api/agents
Content-Type: application/json

{
  "id": "codex",
  "name": "Codex",
  "description": "Swift/SwiftUI implementation expert",
  "status": "offline",
  "workingDirectory": "/path/to/new-repo",
  "skills": [
    { "id": "swift-impl", "name": "Swift Implementation", "tags": ["swift", "swiftui"] }
  ]
}
```

**Response (201):**
```json
{
  "id": "codex",
  "name": "Codex",
  ...
}
```

**Error Response (400):**
```json
{
  "error": "Agent id and name are required"
}
```

#### Delete Agent

```http
DELETE /api/agents/:id
```

**Response (204):** No content

**Error Response (404):**
```json
{
  "error": "Agent not found"
}
```

---

### Logs

#### Query Logs

```http
GET /api/logs?level=info&agentId=qoder&taskId=T001&since=2024-01-15T00:00:00Z
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `level` | string | Filter by log level: `debug`, `info`, `warn`, `error` |
| `agentId` | string | Filter by agent ID |
| `taskId` | string | Filter by task ID |
| `since` | ISO 8601 | Logs after this timestamp |
| `until` | ISO 8601 | Logs before this timestamp |

**Response:**
```json
[
  {
    "timestamp": "2024-01-15T10:00:00.000Z",
    "level": "info",
    "agentId": "qoder",
    "taskId": "T001",
    "message": "Started analyzing dependencies",
    "metadata": { "files": 5 }
  }
]
```

#### Get Recent Logs

```http
GET /api/logs/recent?limit=100
```

**Response:** Array of log entries (most recent first)

#### Stream Logs (SSE)

```http
GET /api/logs/stream
Accept: text/event-stream
```

**Response:** Server-Sent Events stream

```
: connected

data: {"timestamp":"2024-01-15T10:00:00.000Z","level":"info","message":"Task started"}

: keepalive

data: {"timestamp":"2024-01-15T10:01:00.000Z","level":"info","message":"Lock acquired"}
```

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| `200` | Success |
| `201` | Created |
| `204` | No Content (successful deletion) |
| `400` | Bad Request - Missing or invalid parameters |
| `404` | Not Found - Resource does not exist |
| `500` | Internal Server Error |

## Error Response Format

All error responses follow this format:

```json
{
  "error": "Error message describing the issue"
}
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

| Endpoint Type | Rate Limit |
|---------------|------------|
| Read operations | 100 requests/minute |
| Write operations | 30 requests/minute |
| Log streaming | 5 concurrent connections |

## WebSocket Events

For real-time updates, connect to the WebSocket endpoint:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle event
};
```

**Event Types:**

| Event | Description |
|-------|-------------|
| `task:created` | New task created |
| `task:updated` | Task status changed |
| `agent:status` | Agent status changed |
| `lock:acquired` | File lock acquired |
| `lock:released` | File lock released |

---

## Programmatic API

### ACPClientAdapter

Communicate with ACP-compatible AI agents (opencode, claude code):

```typescript
import { ACPClientAdapter } from '@agent-orchestrator/adapter';

const adapter = new ACPClientAdapter({
  name: 'opencode',       // Agent name
  command: 'opencode',    // Command to spawn
  args: ['acp'],          // Command arguments
  cwd: '/path/to/project', // Working directory
  timeout: 90000          // Timeout in ms (default: 300000)
});
```

#### execute(context)

Execute a task with the agent:

```typescript
const result = await adapter.execute({
  task: 'Add a multiply function to math.js',
  context: {}
});

// Result structure
interface AdapterResult {
  output: string;           // Agent's text output
  artifacts?: string[];     // Created files/paths
  error?: string;           // Error message if failed
  locksAcquired?: string[]; // Files locked during execution
  locksReleased?: string[]; // Files released during execution
  toolCalls?: ToolCallRecord[]; // Tool calls made by agent
}
```

#### getStatus()

Check if the agent is available:

```typescript
const status = await adapter.getStatus();
// { online: true } or { online: false, error: "..." }
```

#### cancel()

Cancel any running execution:

```typescript
await adapter.cancel();
```

### ACPConnectionPool

Manage shared connections for concurrent agents:

```typescript
import { ACPConnectionPool, ACPClientAdapter } from '@agent-orchestrator/adapter';

const pool = new ACPConnectionPool(300000); // Default timeout

const adapter1 = new ACPClientAdapter({
  name: 'agent1',
  command: 'opencode',
  args: ['acp'],
  cwd: '/project'
}, pool);

const adapter2 = new ACPClientAdapter({
  name: 'agent2',
  command: 'opencode',
  args: ['acp'],
  cwd: '/project'
}, pool);

// Run concurrently - connections are reused when possible
await Promise.all([
  adapter1.execute({ task: 'Task 1', context: {} }),
  adapter2.execute({ task: 'Task 2', context: {} })
]);

await pool.closeAll();
```

### Lock Protocol

The adapter automatically injects lock protocol instructions into prompts. Agents are instructed to:

1. **Declare locks** before modifying files
2. **Make changes** to the declared files
3. **Release locks** after completing modifications

```typescript
import { LOCK_PROTOCOL_PROMPT } from '@agent-orchestrator/adapter';

console.log(LOCK_PROTOCOL_PROMPT);
// Outputs the lock protocol instructions
```

### Supported Agents

| Agent | Command | Protocol | Status |
|-------|---------|----------|--------|
| opencode | `opencode acp` | ACP v1 | ✅ Verified |
| claude code | `claude acp` | ACP v1 | 🧪 Experimental |