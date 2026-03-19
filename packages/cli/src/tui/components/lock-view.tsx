import React from 'react';
import { Box, Text } from 'ink';
import { FileLock } from '@agent-orchestrator/core';

interface LockViewProps {
  locks: FileLock[];
}

export function LockView({ locks }: LockViewProps) {
  const activeLocks = locks.filter(l => l.status === 'active');

  if (activeLocks.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold underline>Locks</Text>
        <Text dimColor>No active locks</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold underline>Active Locks ({activeLocks.length})</Text>
      {activeLocks.map(lock => (
        <Box key={lock.id} marginLeft={1} flexDirection="column">
          <Box>
            <Text color="cyan">{lock.file}</Text>
            {lock.granularity === 'region' && lock.region && (
              <Text dimColor>:{lock.region.startLine}-{lock.region.endLine}</Text>
            )}
          </Box>
          <Box marginLeft={2}>
            <Text dimColor>held by </Text>
            <Text color="yellow">{lock.holder.agentId}</Text>
            <Text dimColor> for task {lock.holder.taskId.slice(0, 8)}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}