import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ACPClientAdapter } from '../acp-adapter';

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
        command: 'cat',
        args: [],
        timeout: 5000
      });
    });

    it('should execute command and return output', async () => {
      const result = await adapter.execute({
        task: 'hello world',
        context: {}
      });

      expect(result.output).toContain('LOCK PROTOCOL');
      expect(result.output).toContain('hello world');
    });

    it('should track lock tool calls arrays', async () => {
      const result = await adapter.execute({
        task: 'test',
        context: {}
      });

      expect(result.toolCalls).toBeDefined();
      expect(Array.isArray(result.locksAcquired)).toBe(true);
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