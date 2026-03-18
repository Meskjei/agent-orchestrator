import { describe, it, expect, beforeEach } from 'vitest';
import { BrainPersistence } from '../persistence';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('BrainPersistence', () => {
  let tempDir: string;
  let persistence: BrainPersistence;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brain-test-'));
    persistence = new BrainPersistence(tempDir);
  });

  it('should save and load brain state', async () => {
    const brain = {
      id: 'test-brain',
      name: 'Test Project',
      version: '1.0.0',
      goal: { description: 'Test goal', successCriteria: [], constraints: [] },
      agents: [],
      tasks: { root: '', nodes: new Map() },
      context: {
        background: '',
        codeSnippets: new Map(),
        outputs: new Map(),
        pendingQuestions: [],
        recentFileChanges: new Map()
      },
      decisions: [],
      locks: { active: [], history: [] }
    };

    await persistence.save(brain);
    const loaded = await persistence.load();

    expect(loaded?.id).toBe('test-brain');
    expect(loaded?.name).toBe('Test Project');
  });
});