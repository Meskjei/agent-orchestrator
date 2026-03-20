import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { ACPClientAdapter } from '../acp-adapter';

vi.mock('@agentclientprotocol/sdk', () => ({
  ClientSideConnection: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue({ protocolVersion: 1 }),
    newSession: vi.fn().mockResolvedValue({ sessionId: 'test-session' }),
    prompt: vi.fn().mockResolvedValue({ stopReason: 'end_turn' })
  })),
  ndJsonStream: vi.fn().mockReturnValue({
    writable: {},
    readable: {}
  }),
  PROTOCOL_VERSION: 1
}));

vi.mock('stream', () => ({
  Writable: {
    toWeb: vi.fn().mockReturnValue({})
  },
  Readable: {
    toWeb: vi.fn().mockReturnValue({})
  }
}));

describe('ACPClientAdapter', () => {
  let adapter: ACPClientAdapter;

  describe('constructor', () => {
    it('should set default timeout', () => {
      adapter = new ACPClientAdapter({
        name: 'test',
        command: 'opencode'
      });
      expect(adapter.config.timeout).toBe(300000);
    });

    it('should allow custom timeout', () => {
      adapter = new ACPClientAdapter({
        name: 'test',
        command: 'opencode',
        timeout: 60000
      });
      expect(adapter.config.timeout).toBe(60000);
    });

    it('should set default args to ["acp"]', () => {
      adapter = new ACPClientAdapter({
        name: 'test',
        command: 'opencode'
      });
      expect(adapter.config.args).toEqual(['acp']);
    });
  });

  describe('getStatus', () => {
    it('should return online: true for valid command', async () => {
      adapter = new ACPClientAdapter({
        name: 'test',
        command: 'node'
      });
      
      const status = await adapter.getStatus();
      expect(status.online).toBe(true);
    });

    it('should return online: false for invalid command', async () => {
      adapter = new ACPClientAdapter({
        name: 'test',
        command: 'nonexistent-command-xyz'
      });
      
      const status = await adapter.getStatus();
      expect(status.online).toBe(false);
      expect(status.error).toBeDefined();
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      adapter = new ACPClientAdapter({
        name: 'test',
        command: 'opencode',
        args: ['acp'],
        timeout: 5000
      });
    });

    it('should return result with toolCalls array', async () => {
      const result = await adapter.execute({
        task: 'test task',
        context: {}
      });

      expect(result.toolCalls).toBeDefined();
      expect(Array.isArray(result.toolCalls)).toBe(true);
    });

    it('should return result with locksAcquired array', async () => {
      const result = await adapter.execute({
        task: 'test',
        context: {}
      });

      expect(Array.isArray(result.locksAcquired)).toBe(true);
    });

    it('should return result with locksReleased array', async () => {
      const result = await adapter.execute({
        task: 'test',
        context: {}
      });

      expect(Array.isArray(result.locksReleased)).toBe(true);
    });
  });

  describe('cancel', () => {
    it('should be callable without error', async () => {
      adapter = new ACPClientAdapter({
        name: 'test',
        command: 'opencode'
      });

      await expect(adapter.cancel()).resolves.not.toThrow();
    });
  });
});