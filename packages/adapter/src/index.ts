export { CliAdapter } from './cli-adapter';
export { Transformer } from './transformer';
export { LockInterceptor } from './lock-interceptor';
export type { AgentAdapter, AgentAdapterConfig, AdapterContext, AdapterResult } from './adapter';
export { LockProtocolPrompt, generateLockProtocolPrompt } from './prompts/lock-protocol';
export type { LockInfo, TaskInfo, LockProtocolContext } from './prompts/lock-protocol';