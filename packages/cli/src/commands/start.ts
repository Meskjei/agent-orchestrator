import { ProjectBrainImpl } from '@agent-orchestrator/core';

export async function startCommand(baseDir: string): Promise<void> {
  const brain = new ProjectBrainImpl(baseDir);
  const loaded = await brain.load();
  
  if (!loaded) {
    console.log('No project found. Run `agent-orch init` first.');
    return;
  }

  console.log('Starting Orchestrator Agent...');
  console.log(`Project: ${brain.name}`);
  console.log(`Agents: ${brain.agents.length}`);
  console.log(`Tasks: ${brain.tasks.nodes.size}`);
  
  console.log('\n✓ Orchestrator started');
  console.log('Run `agent-orch task create` to create tasks');
}