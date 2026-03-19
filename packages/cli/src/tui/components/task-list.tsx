import React from 'react';
import { Box, Text } from 'ink';
import { TaskNode } from '@agent-orchestrator/core';

interface TaskListProps {
  tasks: TaskNode[];
}

const statusColors: Record<string, string> = {
  pending: 'yellow',
  ready: 'yellow',
  assigned: 'cyan',
  executing: 'blue',
  reviewing: 'magenta',
  revision: 'orange',
  blocked: 'red',
  completed: 'green',
  failed: 'red'
};

export function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold underline>Tasks</Text>
        <Text dimColor>No tasks found</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold underline>Tasks ({tasks.length})</Text>
      {tasks.map(task => (
        <Box key={task.id} marginLeft={1}>
          <Text color={statusColors[task.status] || 'white'}>
            [{task.status.padEnd(10)}]
          </Text>
          <Text> {task.title}</Text>
          {task.assignee && (
            <Text dimColor> ({task.assignee})</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}