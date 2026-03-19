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
    alias: {
      '@agent-orchestrator/core': path.resolve(__dirname, './packages/core/src'),
      '@agent-orchestrator/orchestrator': path.resolve(__dirname, './packages/orchestrator/src'),
      '@agent-orchestrator/adapter': path.resolve(__dirname, './packages/adapter/src'),
      '@agent-orchestrator/cli': path.resolve(__dirname, './packages/cli/src'),
      '@agent-orchestrator/web': path.resolve(__dirname, './packages/web/src')
    }
  }
});