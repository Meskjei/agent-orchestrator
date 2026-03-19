import * as path from 'path';

const MOCK_AGENTS_DIR = path.resolve(__dirname, 'mock-agents');

export const TEST_AGENTS = {
  successAgent: {
    id: 'success-agent',
    name: 'Success Agent',
    description: 'Agent that always succeeds',
    skills: [{ id: 'test', name: 'Testing', tags: ['test'] }],
    command: path.join(MOCK_AGENTS_DIR, 'success-agent.sh'),
    workingDirectory: process.cwd(),
    status: 'online' as const
  },
  slowAgent: {
    id: 'slow-agent',
    name: 'Slow Agent',
    description: 'Agent with 5 second delay',
    skills: [{ id: 'slow', name: 'Slow Operations', tags: ['slow'] }],
    command: path.join(MOCK_AGENTS_DIR, 'slow-agent.sh'),
    workingDirectory: process.cwd(),
    status: 'online' as const
  },
  failingAgent: {
    id: 'failing-agent',
    name: 'Failing Agent',
    description: 'Agent that always fails',
    skills: [{ id: 'fail', name: 'Failing', tags: ['fail'] }],
    command: path.join(MOCK_AGENTS_DIR, 'failing-agent.sh'),
    workingDirectory: process.cwd(),
    status: 'online' as const
  },
  lockDeclareAgent: {
    id: 'lock-declare-agent',
    name: 'Lock Declare Agent',
    description: 'Agent that outputs lock protocol',
    skills: [{ id: 'lock', name: 'Lock Protocol', tags: ['lock'] }],
    command: path.join(MOCK_AGENTS_DIR, 'lock-declare.sh'),
    workingDirectory: process.cwd(),
    status: 'online' as const
  }
};

export type TestAgentKey = keyof typeof TEST_AGENTS;