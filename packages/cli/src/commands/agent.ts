import * as fs from 'fs/promises';
import * as path from 'path';

interface AgentConfig {
  name: string;
  description: string;
  type: 'cli' | 'api';
  command?: string;
  endpoint?: string;
  cwd?: string;
  skills: string[];
}

export async function addAgentCommand(baseDir: string, name: string, configPath?: string): Promise<void> {
  let config: AgentConfig;
  
  if (configPath) {
    const content = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(content);
  } else {
    config = {
      name,
      description: `${name} agent`,
      type: 'cli',
      command: name,
      skills: []
    };
  }

  const agentPath = path.join(baseDir, '.agent-orch', 'agents', `${name}.json`);
  await fs.writeFile(agentPath, JSON.stringify(config, null, 2));
  
  console.log(`✓ Agent "${name}" registered`);
}

export async function listAgentsCommand(baseDir: string): Promise<void> {
  const agentsDir = path.join(baseDir, '.agent-orch', 'agents');
  
  try {
    const files = await fs.readdir(agentsDir);
    if (files.length === 0) {
      console.log('No agents registered');
      return;
    }
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(agentsDir, file), 'utf-8');
        const config = JSON.parse(content);
        console.log(`- ${config.name}: ${config.description}`);
      }
    }
  } catch {
    console.log('No agents registered');
  }
}