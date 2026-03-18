import * as fs from 'fs/promises';
import * as path from 'path';
import { ProjectBrain } from '../types';

export class BrainPersistence {
  private filePath: string;

  constructor(private baseDir: string) {
    this.filePath = path.join(baseDir, '.agent-orch', 'brain.json');
  }

  async save(brain: ProjectBrain): Promise<void> {
    const brainDir = path.dirname(this.filePath);
    await fs.mkdir(brainDir, { recursive: true });
    
    const serializable = {
      ...brain,
      tasks: {
        root: brain.tasks.root,
        nodes: Array.from(brain.tasks.nodes.entries())
      },
      context: {
        ...brain.context,
        codeSnippets: Array.from(brain.context.codeSnippets.entries()),
        outputs: Array.from(brain.context.outputs.entries()),
        recentFileChanges: Array.from(brain.context.recentFileChanges.entries())
      }
    };
    
    await fs.writeFile(this.filePath, JSON.stringify(serializable, null, 2));
  }

  async load(): Promise<ProjectBrain | null> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(content);
      
      return {
        ...data,
        tasks: {
          root: data.tasks.root,
          nodes: new Map(data.tasks.nodes)
        },
        context: {
          ...data.context,
          codeSnippets: new Map(data.context.codeSnippets),
          outputs: new Map(data.context.outputs),
          recentFileChanges: new Map(data.context.recentFileChanges)
        }
      };
    } catch {
      return null;
    }
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }
}