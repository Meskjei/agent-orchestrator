import React from 'react';
import { Box, Text } from 'ink';
import { TaskNode, AgentRole, FileLock } from '@agent-orchestrator/core';
import { TaskList } from './components/task-list.js';
import { AgentStatus } from './components/agent-status.js';
import { LockView } from './components/lock-view.js';

interface TuiAppProps {
  projectName: string;
  tasks: TaskNode[];
  agents: AgentRole[];
  locks: FileLock[];
}

export function TuiApp({ projectName, tasks, agents, locks }: TuiAppProps) {
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Agent Orchestrator - {projectName}
        </Text>
      </Box>
      
      <Box flexDirection="row" gap={4}>
        <Box flexDirection="column" width="50%">
          <TaskList tasks={tasks} />
        </Box>
        
        <Box flexDirection="column" width="50%">
          <AgentStatus agents={agents} />
          <Box marginTop={1}>
            <LockView locks={locks} />
          </Box>
        </Box>
      </Box>
      
      <Box marginTop={1}>
        <Text dimColor>Press Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}