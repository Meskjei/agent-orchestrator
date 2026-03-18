import * as fs from 'fs/promises';
import * as path from 'path';

interface InitOptions {
  name: string;
  description: string;
  goal: string;
}

export async function initCommand(baseDir: string, options: InitOptions): Promise<void> {
  const orchDir = path.join(baseDir, '.agent-orch');
  await fs.mkdir(orchDir, { recursive: true });

  const brain = {
    id: crypto.randomUUID(),
    name: options.name,
    version: '1.0.0',
    goal: {
      description: options.goal,
      successCriteria: [],
      constraints: []
    },
    agents: [],
    tasks: { root: '', nodes: [] },
    context: {
      background: options.description,
      codeSnippets: [],
      outputs: [],
      pendingQuestions: [],
      recentFileChanges: []
    },
    decisions: [],
    locks: { active: [], history: [] }
  };

  await fs.writeFile(
    path.join(orchDir, 'brain.json'),
    JSON.stringify(brain, null, 2)
  );

  await fs.writeFile(
    path.join(orchDir, 'config.yaml'),
    `name: ${options.name}
description: ${options.description}
goal: ${options.goal}
version: "1.0.0"
`
  );

  await fs.mkdir(path.join(orchDir, 'agents'), { recursive: true });
  
  console.log('✓ Created .agent-orch/config.yaml');
  console.log('✓ Created .agent-orch/brain.json');
  console.log('✓ Created .agent-orch/agents/');
}