import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectBrainImpl } from '../brain';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ProjectBrainImpl', () => {
  let tempDir: string;
  let brain: ProjectBrainImpl;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brain-test-'));
    brain = new ProjectBrainImpl(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should create brain with default values', () => {
    expect(brain.id).toBeDefined();
    expect(brain.name).toBe('Untitled Project');
    expect(brain.version).toBe('1.0.0');
    expect(brain.agents).toEqual([]);
    expect(brain.tasks.nodes.size).toBe(0);
  });

  it('should create brain with custom values', () => {
    const customBrain = new ProjectBrainImpl(tempDir, {
      id: 'custom-id',
      name: 'Custom Project',
      version: '2.0.0'
    });
    
    expect(customBrain.id).toBe('custom-id');
    expect(customBrain.name).toBe('Custom Project');
    expect(customBrain.version).toBe('2.0.0');
  });

  it('should add and get tasks', () => {
    const task = {
      id: 'task-1',
      title: 'Test Task',
      description: 'Test description',
      type: 'task' as const,
      status: 'pending' as const,
      statusHistory: [],
      dependencies: [],
      estimatedFiles: [],
      children: [],
      expectedOutput: {
        type: 'code' as const,
        description: 'Test output',
        acceptanceCriteria: []
      }
    };
    
    brain.addTask(task);
    const retrieved = brain.getTask('task-1');
    
    expect(retrieved).toBeDefined();
    expect(retrieved?.title).toBe('Test Task');
  });

  it('should update task status', () => {
    const task = {
      id: 'task-1',
      title: 'Test Task',
      description: 'Test description',
      type: 'task' as const,
      status: 'pending' as const,
      statusHistory: [],
      dependencies: [],
      estimatedFiles: [],
      children: [],
      expectedOutput: {
        type: 'code' as const,
        description: 'Test output',
        acceptanceCriteria: []
      }
    };
    
    brain.addTask(task);
    brain.updateTaskStatus('task-1', 'executing', 'agent-1', 'Starting work');
    
    const updated = brain.getTask('task-1');
    expect(updated?.status).toBe('executing');
    expect(updated?.statusHistory.length).toBe(1);
    expect(updated?.statusHistory[0].changedBy).toBe('agent-1');
  });

  it('should add and get agents', () => {
    const agent = {
      id: 'agent-1',
      name: 'Test Agent',
      description: 'Test agent description',
      skills: [],
      workingDirectory: '/test',
      status: 'online' as const
    };
    
    brain.addAgent(agent);
    const retrieved = brain.getAgent('agent-1');
    
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Test Agent');
  });

  it('should update existing agent', () => {
    const agent = {
      id: 'agent-1',
      name: 'Test Agent',
      description: 'Test agent description',
      skills: [],
      workingDirectory: '/test',
      status: 'online' as const
    };
    
    brain.addAgent(agent);
    
    const updatedAgent = {
      ...agent,
      status: 'busy' as const,
      currentTask: 'task-1'
    };
    
    brain.addAgent(updatedAgent);
    
    expect(brain.agents.length).toBe(1);
    expect(brain.getAgent('agent-1')?.status).toBe('busy');
  });

  it('should save and load brain state', async () => {
    brain.name = 'Persisted Project';
    brain.version = '3.0.0';
    
    const task = {
      id: 'task-1',
      title: 'Persisted Task',
      description: 'Test description',
      type: 'task' as const,
      status: 'pending' as const,
      statusHistory: [],
      dependencies: [],
      estimatedFiles: [],
      children: [],
      expectedOutput: {
        type: 'code' as const,
        description: 'Test output',
        acceptanceCriteria: []
      }
    };
    
    brain.addTask(task);
    await brain.save();
    
    const newBrain = new ProjectBrainImpl(tempDir);
    const loaded = await newBrain.load();
    
    expect(loaded).toBe(true);
    expect(newBrain.name).toBe('Persisted Project');
    expect(newBrain.version).toBe('3.0.0');
    expect(newBrain.getTask('task-1')?.title).toBe('Persisted Task');
  });
});