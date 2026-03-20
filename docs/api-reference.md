# API 参考

本文档描述 Agent Orchestrator 提供的 REST API 端点和编程 API。

## REST API

### 基础 URL

```
http://localhost:3000/api
```

### 认证

大多数端点需要通过 Bearer token 认证：

```
Authorization: Bearer <token>
```

公开端点（无需认证）：
- `GET /api/health`
- `GET /api/status`

## 端点

### 健康检查

```http
GET /api/health
```

**响应:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### 项目状态

```http
GET /api/status
```

**响应:**
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

### 任务

#### 获取所有任务

```http
GET /api/tasks
```

**响应:**
```json
[
  {
    "id": "T001",
    "title": "分析 CardTableViewCell 依赖",
    "description": "分析 CardTableViewCell 的依赖关系",
    "type": "task",
    "status": "executing",
    "assignee": "qoder",
    "dependencies": [],
    "estimatedFiles": ["CardTableViewCell.m", "CardTableViewCell.h"],
    "expectedOutput": {
      "type": "document",
      "description": "依赖分析文档",
      "acceptanceCriteria": ["列出所有依赖", "生成依赖图"]
    },
    "statusHistory": [
      { "status": "pending", "changedAt": "2024-01-15T09:00:00.000Z", "changedBy": "cli" },
      { "status": "assigned", "changedAt": "2024-01-15T09:05:00.000Z", "changedBy": "orchestrator" },
      { "status": "executing", "changedAt": "2024-01-15T09:10:00.000Z", "changedBy": "qoder" }
    ]
  }
]
```

#### 根据 ID 获取任务

```http
GET /api/tasks/:id
```

**响应:** 单个任务对象（见上）

**错误响应 (404):**
```json
{
  "error": "任务未找到"
}
```

#### 创建任务

```http
POST /api/tasks
Content-Type: application/json

{
  "id": "T002",
  "title": "实现 CardViewModel",
  "description": "实现 SwiftUI CardViewModel",
  "type": "task",
  "status": "pending",
  "dependencies": ["T001"],
  "estimatedFiles": ["CardViewModel.swift"],
  "expectedOutput": {
    "type": "code",
    "description": "SwiftUI CardViewModel 实现",
    "acceptanceCriteria": ["遵循 MVVM 模式", "包含单元测试"]
  }
}
```

**响应 (201):**
```json
{
  "id": "T002",
  "title": "实现 CardViewModel",
  ...
}
```

**错误响应 (400):**
```json
{
  "error": "任务 id 和 title 为必填项"
}
```

#### 更新任务状态

```http
PUT /api/tasks/:id/status
Content-Type: application/json

{
  "status": "completed",
  "changedBy": "qoder",
  "reason": "所有验收标准已满足"
}
```

**响应:**
```json
{
  "id": "T001",
  "status": "completed",
  "statusHistory": [
    ...历史记录,
    { "status": "completed", "changedAt": "2024-01-15T10:00:00.000Z", "changedBy": "qoder", "reason": "所有验收标准已满足" }
  ]
}
```

---

### 代理

#### 获取所有代理

```http
GET /api/agents
```

**响应:**
```json
[
  {
    "id": "qoder",
    "name": "Qoder",
    "description": "Objective-C 分析的原生代码专家",
    "status": "online",
    "workingDirectory": "/path/to/native-repo",
    "skills": [
      { "id": "analyze-dependencies", "name": "分析依赖", "tags": ["analysis", "objc"] },
      { "id": "refactor-code", "name": "重构代码", "tags": ["refactoring", "objc"] }
    ],
    "currentTask": "T001"
  }
]
```

#### 根据 ID 获取代理

```http
GET /api/agents/:id
```

**响应:** 单个代理对象（见上）

**错误响应 (404):**
```json
{
  "error": "代理未找到"
}
```

#### 注册代理

```http
POST /api/agents
Content-Type: application/json

{
  "id": "codex",
  "name": "Codex",
  "description": "Swift/SwiftUI 实现专家",
  "status": "offline",
  "workingDirectory": "/path/to/new-repo",
  "skills": [
    { "id": "swift-impl", "name": "Swift 实现", "tags": ["swift", "swiftui"] }
  ]
}
```

**响应 (201):**
```json
{
  "id": "codex",
  "name": "Codex",
  ...
}
```

**错误响应 (400):**
```json
{
  "error": "代理 id 和 name 为必填项"
}
```

#### 删除代理

```http
DELETE /api/agents/:id
```

**响应 (204):** 无内容

**错误响应 (404):**
```json
{
  "error": "代理未找到"
}
```

---

### 日志

#### 查询日志

```http
GET /api/logs?level=info&agentId=qoder&taskId=T001&since=2024-01-15T00:00:00Z
```

**查询参数:**

| 参数 | 类型 | 描述 |
|------|------|------|
| `level` | string | 按日志级别过滤: `debug`, `info`, `warn`, `error` |
| `agentId` | string | 按代理 ID 过滤 |
| `taskId` | string | 按任务 ID 过滤 |
| `since` | ISO 8601 | 此时间戳之后的日志 |
| `until` | ISO 8601 | 此时间戳之前的日志 |

**响应:**
```json
[
  {
    "timestamp": "2024-01-15T10:00:00.000Z",
    "level": "info",
    "agentId": "qoder",
    "taskId": "T001",
    "message": "开始分析依赖",
    "metadata": { "files": 5 }
  }
]
```

#### 获取最近日志

```http
GET /api/logs/recent?limit=100
```

**响应:** 日志条目数组（最近的在前）

#### 流式日志 (SSE)

```http
GET /api/logs/stream
Accept: text/event-stream
```

**响应:** Server-Sent Events 流

```
: connected

data: {"timestamp":"2024-01-15T10:00:00.000Z","level":"info","message":"任务已开始"}

: keepalive

data: {"timestamp":"2024-01-15T10:01:00.000Z","level":"info","message":"锁已获取"}
```

---

## 错误码

| 状态码 | 描述 |
|--------|------|
| `200` | 成功 |
| `201` | 已创建 |
| `204` | 无内容（删除成功） |
| `400` | 错误请求 - 缺少或无效参数 |
| `404` | 未找到 - 资源不存在 |
| `500` | 服务器内部错误 |

## 错误响应格式

所有错误响应遵循此格式：

```json
{
  "error": "描述问题的错误信息"
}
```

## 速率限制

API 端点有速率限制以防止滥用：

| 端点类型 | 速率限制 |
|---------|---------|
| 读操作 | 100 请求/分钟 |
| 写操作 | 30 请求/分钟 |
| 日志流 | 5 个并发连接 |

## WebSocket 事件

对于实时更新，连接到 WebSocket 端点：

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // 处理事件
};
```

**事件类型:**

| 事件 | 描述 |
|------|------|
| `task:created` | 新任务已创建 |
| `task:updated` | 任务状态已更改 |
| `agent:status` | 代理状态已更改 |
| `lock:acquired` | 文件锁已获取 |
| `lock:released` | 文件锁已释放 |

---

## 编程 API

### ACPClientAdapter

与 ACP 兼容的 AI 代理（opencode、claude code）通信：

```typescript
import { ACPClientAdapter } from '@agent-orchestrator/adapter';

const adapter = new ACPClientAdapter({
  name: 'opencode',       // 代理名称
  command: 'opencode',    // 启动命令
  args: ['acp'],          // 命令参数
  cwd: '/path/to/project', // 工作目录
  timeout: 90000          // 超时时间（毫秒），默认: 300000
});
```

#### execute(context)

执行任务：

```typescript
const result = await adapter.execute({
  task: '在 math.js 中添加一个乘法函数',
  context: {}
});

// 返回结果结构
interface AdapterResult {
  output: string;           // 代理的文本输出
  artifacts?: string[];     // 创建的文件/路径
  error?: string;           // 错误信息
  locksAcquired?: string[]; // 执行期间获取的锁
  locksReleased?: string[]; // 执行期间释放的锁
  toolCalls?: ToolCallRecord[]; // 代理发起的工具调用
}
```

#### getStatus()

检查代理是否可用：

```typescript
const status = await adapter.getStatus();
// { online: true } 或 { online: false, error: "..." }
```

#### cancel()

取消正在执行的任务：

```typescript
await adapter.cancel();
```

### ACPConnectionPool

管理并发代理的共享连接：

```typescript
import { ACPConnectionPool, ACPClientAdapter } from '@agent-orchestrator/adapter';

const pool = new ACPConnectionPool(300000); // 默认超时

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

// 并发执行 - 尽可能复用连接
await Promise.all([
  adapter1.execute({ task: '任务 1', context: {} }),
  adapter2.execute({ task: '任务 2', context: {} })
]);

await pool.closeAll();
```

### 锁协议

适配器自动在提示中注入锁协议指令。代理被指示：

1. **声明锁** - 在修改文件之前
2. **进行更改** - 在已声明的文件上
3. **释放锁** - 完成修改之后

```typescript
import { LOCK_PROTOCOL_PROMPT } from '@agent-orchestrator/adapter';

console.log(LOCK_PROTOCOL_PROMPT);
// 输出锁协议指令
```

### 支持的代理

| 代理 | 命令 | 协议 | 状态 |
|------|------|------|------|
| opencode | `opencode acp` | ACP v1 | ✅ 已验证 |
| claude code | `claude acp` | ACP v1 | 🧪 实验性 |