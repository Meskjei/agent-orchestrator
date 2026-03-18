import { describe, it, expect } from 'vitest';
import { LockProtocolPrompt, generateLockProtocolPrompt } from '../lock-protocol';

describe('Lock Protocol Prompts', () => {
  it('should generate lock protocol prompt', () => {
    const prompt = generateLockProtocolPrompt({
      locks: [
        { file: 'file1.ts', holder: 'agent-1', status: 'active' }
      ],
      task: {
        title: 'Test task',
        description: 'Test description'
      }
    });

    expect(prompt).toContain('file1.ts');
    expect(prompt).toContain('agent-1');
    expect(prompt).toContain('[DECLARE]');
    expect(prompt).toContain('[RELEASE]');
  });

  it('should handle empty locks', () => {
    const prompt = generateLockProtocolPrompt({
      locks: [],
      task: {
        title: 'Test task',
        description: 'Test description'
      }
    });

    expect(prompt).toContain('无活跃锁');
  });

  it('should include task title and description', () => {
    const prompt = generateLockProtocolPrompt({
      locks: [],
      task: {
        title: 'Implement feature X',
        description: 'Add new functionality to the system'
      }
    });

    expect(prompt).toContain('Implement feature X');
    expect(prompt).toContain('Add new functionality to the system');
  });

  it('should include EXTEND pattern in prompt', () => {
    const prompt = generateLockProtocolPrompt({
      locks: [],
      task: {
        title: 'Test task',
        description: 'Test description'
      }
    });

    expect(prompt).toContain('[EXTEND]');
  });

  it('should format multiple locks in table', () => {
    const prompt = generateLockProtocolPrompt({
      locks: [
        { file: 'file1.ts', holder: 'agent-1', status: 'active' },
        { file: 'file2.ts', holder: 'agent-2', status: 'pending' }
      ],
      task: {
        title: 'Test task',
        description: 'Test description'
      }
    });

    expect(prompt).toContain('file1.ts');
    expect(prompt).toContain('file2.ts');
    expect(prompt).toContain('agent-1');
    expect(prompt).toContain('agent-2');
    expect(prompt).toContain('active');
    expect(prompt).toContain('pending');
  });
});

describe('LockProtocolPrompt object', () => {
  it('should have generate function', () => {
    expect(LockProtocolPrompt.generate).toBe(generateLockProtocolPrompt);
  });

  it('should have DECLARE_PATTERN', () => {
    expect(LockProtocolPrompt.DECLARE_PATTERN).toBeInstanceOf(RegExp);
    expect('[DECLARE] 我要修改: file.ts').toMatch(LockProtocolPrompt.DECLARE_PATTERN);
  });

  it('should have RELEASE_PATTERN', () => {
    expect(LockProtocolPrompt.RELEASE_PATTERN).toBeInstanceOf(RegExp);
    expect('[RELEASE] file.ts').toMatch(LockProtocolPrompt.RELEASE_PATTERN);
  });

  it('should have EXTEND_PATTERN', () => {
    expect(LockProtocolPrompt.EXTEND_PATTERN).toBeInstanceOf(RegExp);
    expect('[EXTEND] file.ts').toMatch(LockProtocolPrompt.EXTEND_PATTERN);
  });

  it('should have GRANTED_TEMPLATE', () => {
    const result = LockProtocolPrompt.GRANTED_TEMPLATE('file.ts');
    expect(result).toBe('[LOCK GRANTED] file.ts');
  });

  it('should have DENIED_TEMPLATE', () => {
    const result = LockProtocolPrompt.DENIED_TEMPLATE('file.ts', 'agent-1');
    expect(result).toBe('[LOCK DENIED] file.ts - 被 agent-1 锁定');
  });

  it('should have EXTENDED_TEMPLATE', () => {
    const result = LockProtocolPrompt.EXTENDED_TEMPLATE('file.ts');
    expect(result).toBe('[LOCK EXTENDED] file.ts');
  });
});