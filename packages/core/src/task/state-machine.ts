import { TaskStatus } from '../types.js';

export interface TransitionRecord {
  from: TaskStatus;
  to: TaskStatus;
  timestamp: Date;
  reason: string;
  changedBy: string;
}

const VALID_TRANSITIONS: Map<TaskStatus, TaskStatus[]> = new Map([
  ['pending', ['ready', 'blocked']],
  ['ready', ['assigned', 'pending']],
  ['assigned', ['executing', 'ready', 'blocked']],
  ['executing', ['reviewing', 'blocked', 'assigned']],
  ['reviewing', ['completed', 'revision', 'blocked']],
  ['revision', ['reviewing', 'blocked']],
  ['blocked', ['ready', 'pending', 'failed']],
  ['completed', []],
  ['failed', ['pending', 'ready']],
]);

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  const allowedTransitions = VALID_TRANSITIONS.get(from);
  return allowedTransitions ? allowedTransitions.includes(to) : false;
}

export class TaskStateMachine {
  private _current: TaskStatus;
  private history: TransitionRecord[] = [];

  constructor(initial: TaskStatus = 'pending') {
    this._current = initial;
  }

  get current(): TaskStatus {
    return this._current;
  }

  transition(to: TaskStatus, reason: string, changedBy?: string): boolean {
    if (!canTransition(this._current, to)) {
      return false;
    }

    this.history.push({
      from: this._current,
      to,
      timestamp: new Date(),
      reason,
      changedBy: changedBy ?? 'unknown',
    });

    this._current = to;
    return true;
  }

  forceTransition(to: TaskStatus, reason: string, changedBy: string): void {
    this.history.push({
      from: this._current,
      to,
      timestamp: new Date(),
      reason,
      changedBy,
    });

    this._current = to;
  }

  getHistory(): TransitionRecord[] {
    return [...this.history];
  }

  canTransitionTo(to: TaskStatus): boolean {
    return canTransition(this._current, to);
  }

  getValidTransitions(): TaskStatus[] {
    return VALID_TRANSITIONS.get(this._current) ?? [];
  }
}