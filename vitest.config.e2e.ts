import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000
  },
  resolve: {
    alias: [
      { find: /^@agent-orchestrator\/core\/brain\/brain$/, replacement: path.resolve(__dirname, './packages/core/src/brain/brain.ts') },
      { find: /^@agent-orchestrator\/core\/lock\/manager$/, replacement: path.resolve(__dirname, './packages/core/src/lock/manager.ts') },
      { find: /^@agent-orchestrator\/core\/conflict\/detector$/, replacement: path.resolve(__dirname, './packages/core/src/conflict/detector.ts') },
      { find: /^@agent-orchestrator\/core\/conflict\/region-detector$/, replacement: path.resolve(__dirname, './packages/core/src/conflict/region-detector.ts') },
      { find: /^@agent-orchestrator\/core\/conflict\/semantic-detector$/, replacement: path.resolve(__dirname, './packages/core/src/conflict/semantic-detector.ts') },
      { find: /^@agent-orchestrator\/core\/task\/state-machine$/, replacement: path.resolve(__dirname, './packages/core/src/task/state-machine.ts') },
      { find: /^@agent-orchestrator\/core\/logging\/logger$/, replacement: path.resolve(__dirname, './packages/core/src/logging/logger.ts') },
      { find: /^@agent-orchestrator\/orchestrator\/skills\/task-decomposition$/, replacement: path.resolve(__dirname, './packages/orchestrator/src/skills/task-decomposition.ts') },
      { find: /^@agent-orchestrator\/orchestrator\/skills\/agent-dispatch$/, replacement: path.resolve(__dirname, './packages/orchestrator/src/skills/agent-dispatch.ts') },
      { find: /^@agent-orchestrator\/orchestrator\/skills\/lock-management$/, replacement: path.resolve(__dirname, './packages/orchestrator/src/skills/lock-management.ts') },
      { find: /^@agent-orchestrator\/orchestrator\/skills\/task-review$/, replacement: path.resolve(__dirname, './packages/orchestrator/src/skills/task-review.ts') },
      { find: /^@agent-orchestrator\/orchestrator\/skills\/decision-log$/, replacement: path.resolve(__dirname, './packages/orchestrator/src/skills/decision-log.ts') },
      { find: /^@agent-orchestrator\/adapter\/cli-adapter$/, replacement: path.resolve(__dirname, './packages/adapter/src/cli-adapter.ts') },
      { find: /^@agent-orchestrator\/adapter\/prompts\/lock-protocol$/, replacement: path.resolve(__dirname, './packages/adapter/src/prompts/lock-protocol.ts') },
      { find: /^@agent-orchestrator\/web\/server$/, replacement: path.resolve(__dirname, './packages/web/src/server.ts') },
      { find: '@agent-orchestrator/core', replacement: path.resolve(__dirname, './packages/core/src') },
      { find: '@agent-orchestrator/orchestrator', replacement: path.resolve(__dirname, './packages/orchestrator/src') },
      { find: '@agent-orchestrator/adapter', replacement: path.resolve(__dirname, './packages/adapter/src') },
      { find: '@agent-orchestrator/cli', replacement: path.resolve(__dirname, './packages/cli/src') },
      { find: '@agent-orchestrator/web', replacement: path.resolve(__dirname, './packages/web/src') }
    ]
  }
});