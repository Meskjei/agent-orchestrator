import { describe, it, expect } from 'vitest';
import { TaskStateMachine, canTransition } from '../state-machine';

describe('canTransition', () => {
  it('should allow valid transitions', () => {
    expect(canTransition('pending', 'ready')).toBe(true);
    expect(canTransition('ready', 'assigned')).toBe(true);
    expect(canTransition('assigned', 'executing')).toBe(true);
    expect(canTransition('executing', 'reviewing')).toBe(true);
    expect(canTransition('reviewing', 'completed')).toBe(true);
  });

  it('should deny invalid transitions', () => {
    expect(canTransition('pending', 'executing')).toBe(false);
    expect(canTransition('completed', 'executing')).toBe(false);
  });

  it('should allow all valid transitions from each state', () => {
    expect(canTransition('pending', 'ready')).toBe(true);
    expect(canTransition('pending', 'blocked')).toBe(true);

    expect(canTransition('ready', 'assigned')).toBe(true);
    expect(canTransition('ready', 'pending')).toBe(true);

    expect(canTransition('assigned', 'executing')).toBe(true);
    expect(canTransition('assigned', 'ready')).toBe(true);
    expect(canTransition('assigned', 'blocked')).toBe(true);

    expect(canTransition('executing', 'reviewing')).toBe(true);
    expect(canTransition('executing', 'blocked')).toBe(true);
    expect(canTransition('executing', 'assigned')).toBe(true);

    expect(canTransition('reviewing', 'completed')).toBe(true);
    expect(canTransition('reviewing', 'revision')).toBe(true);
    expect(canTransition('reviewing', 'blocked')).toBe(true);

    expect(canTransition('revision', 'reviewing')).toBe(true);
    expect(canTransition('revision', 'blocked')).toBe(true);

    expect(canTransition('blocked', 'ready')).toBe(true);
    expect(canTransition('blocked', 'pending')).toBe(true);
    expect(canTransition('blocked', 'failed')).toBe(true);

    expect(canTransition('failed', 'pending')).toBe(true);
    expect(canTransition('failed', 'ready')).toBe(true);
  });

  it('should deny all transitions from completed', () => {
    expect(canTransition('completed', 'pending')).toBe(false);
    expect(canTransition('completed', 'ready')).toBe(false);
    expect(canTransition('completed', 'failed')).toBe(false);
  });
});

describe('TaskStateMachine', () => {
  it('should default to pending status', () => {
    const machine = new TaskStateMachine();
    expect(machine.current).toBe('pending');
  });

  it('should accept initial status', () => {
    const machine = new TaskStateMachine('assigned');
    expect(machine.current).toBe('assigned');
  });

  it('should transition with state machine', () => {
    const machine = new TaskStateMachine('pending');

    machine.transition('ready', 'dependencies completed');
    expect(machine.current).toBe('ready');

    machine.transition('assigned', 'agent-1 assigned');
    expect(machine.current).toBe('assigned');
  });

  it('should return false for invalid transitions', () => {
    const machine = new TaskStateMachine('pending');
    const result = machine.transition('executing', 'skip steps');
    expect(result).toBe(false);
    expect(machine.current).toBe('pending');
  });

  it('should return true for valid transitions', () => {
    const machine = new TaskStateMachine('pending');
    const result = machine.transition('ready', 'dependencies completed');
    expect(result).toBe(true);
    expect(machine.current).toBe('ready');
  });

  it('should record transition history', () => {
    const machine = new TaskStateMachine('pending');
    machine.transition('ready', 'test reason', 'agent-1');

    const history = machine.getHistory();
    expect(history.length).toBe(1);
    expect(history[0].from).toBe('pending');
    expect(history[0].to).toBe('ready');
    expect(history[0].reason).toBe('test reason');
    expect(history[0].changedBy).toBe('agent-1');
    expect(history[0].timestamp).toBeInstanceOf(Date);
  });

  it('should record multiple transitions in history', () => {
    const machine = new TaskStateMachine('pending');
    
    machine.transition('ready', 'deps done', 'agent-1');
    machine.transition('assigned', 'assigned', 'agent-2');
    machine.transition('executing', 'starting work', 'agent-2');

    const history = machine.getHistory();
    expect(history.length).toBe(3);
    expect(history[0].from).toBe('pending');
    expect(history[1].from).toBe('ready');
    expect(history[2].from).toBe('assigned');
  });

  it('should not add to history on failed transition', () => {
    const machine = new TaskStateMachine('pending');
    machine.transition('executing', 'invalid');

    const history = machine.getHistory();
    expect(history.length).toBe(0);
  });

  it('should force transition regardless of rules', () => {
    const machine = new TaskStateMachine('pending');
    machine.forceTransition('completed', 'admin override', 'admin');

    expect(machine.current).toBe('completed');
    const history = machine.getHistory();
    expect(history.length).toBe(1);
    expect(history[0].reason).toBe('admin override');
    expect(history[0].changedBy).toBe('admin');
  });

  it('should check canTransitionTo', () => {
    const machine = new TaskStateMachine('pending');
    expect(machine.canTransitionTo('ready')).toBe(true);
    expect(machine.canTransitionTo('blocked')).toBe(true);
    expect(machine.canTransitionTo('executing')).toBe(false);
  });

  it('should get valid transitions', () => {
    const machine = new TaskStateMachine('pending');
    const valid = machine.getValidTransitions();
    expect(valid).toEqual(['ready', 'blocked']);
  });

  it('should return empty array for completed state', () => {
    const machine = new TaskStateMachine('completed');
    const valid = machine.getValidTransitions();
    expect(valid).toEqual([]);
  });

  it('should default changedBy to unknown when not provided', () => {
    const machine = new TaskStateMachine('pending');
    machine.transition('ready', 'test');
    
    const history = machine.getHistory();
    expect(history[0].changedBy).toBe('unknown');
  });

  it('should return copy of history array', () => {
    const machine = new TaskStateMachine('pending');
    machine.transition('ready', 'test');
    
    const history1 = machine.getHistory();
    const history2 = machine.getHistory();
    
    expect(history1).not.toBe(history2);
    expect(history1).toEqual(history2);
  });
});