export interface LockInfo {
  file: string;
  holder: string;
  status: 'active' | 'pending' | 'expired';
}

export interface TaskInfo {
  title: string;
  description: string;
}

export interface LockProtocolContext {
  locks: LockInfo[];
  task: TaskInfo;
}

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

export function generateLockProtocolPrompt(context: LockProtocolContext): string {
  const { locks, task } = context;
  
  const lockTable = locks.length > 0
    ? formatLockTable(locks)
    : '无活跃锁';
  
  return `## 锁协议

当前任务: ${task.title}
任务描述: ${task.description}

### 当前锁状态
${lockTable}

### 锁操作规则
- [DECLARE] 我要修改: <文件路径> - 声明要锁定文件
- [RELEASE] <文件路径> - 释放已锁定的文件
- [EXTEND] <文件路径> - 延长锁定时间

### 协议要求
1. 修改文件前必须先获取锁
2. 完成修改后必须释放锁
3. 锁即将过期时可申请延长
4. 只能操作自己持有的锁`;
}

function formatLockTable(locks: LockInfo[]): string {
  const header = '| 文件 | 持有者 | 状态 |';
  const separator = '|------|--------|------|';
  const rows = locks.map(lock => 
    `| ${lock.file} | ${lock.holder} | ${lock.status} |`
  ).join('\n');
  
  return `${header}\n${separator}\n${rows}`;
}

export const DECLARE_PATTERN = /\[DECLARE\]\s*我要修改:\s*(.+)/;
export const RELEASE_PATTERN = /\[RELEASE\]\s*(.+)/;
export const EXTEND_PATTERN = /\[EXTEND\]\s*(.+)/;

export function GRANTED_TEMPLATE(file: string): string {
  return `[LOCK GRANTED] ${file}`;
}

export function DENIED_TEMPLATE(file: string, holder: string): string {
  return `[LOCK DENIED] ${file} - 被 ${holder} 锁定`;
}

export function EXTENDED_TEMPLATE(file: string): string {
  return `[LOCK EXTENDED] ${file}`;
}

export const LockProtocolPrompt = {
  generate: generateLockProtocolPrompt,
  DECLARE_PATTERN,
  RELEASE_PATTERN,
  EXTEND_PATTERN,
  GRANTED_TEMPLATE,
  DENIED_TEMPLATE,
  EXTENDED_TEMPLATE,
};