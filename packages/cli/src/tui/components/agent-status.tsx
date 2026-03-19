import React from 'react';
import { Box, Text } from 'ink';
import { AgentRole } from '@agent-orchestrator/core';

interface AgentStatusProps {
  agents: AgentRole[];
}

const statusIcons: Record<string, string> = {
  online: '\u25CF',
  offline: '\u25CB',
  busy: '\u25D0',
  error: '\u2573'
};

const statusColors: Record<string, string> = {
  online: 'green',
  offline: 'gray',
  busy: 'yellow',
  error: 'red'
};

export function AgentStatus({ agents }: AgentStatusProps) {
  if (agents.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold underline>Agents</Text>
        <Text dimColor>No agents registered</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold underline>Agents ({agents.length})</Text>
      {agents.map(agent => (
        <Box key={agent.id} marginLeft={1}>
          <Text color={statusColors[agent.status] || 'white'}>
            {statusIcons[agent.status] || '?'} 
          </Text>
          <Text> {agent.name}</Text>
          {agent.currentTask && (
            <Text dimColor> [working on: {agent.currentTask}]</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}