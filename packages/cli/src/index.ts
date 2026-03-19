#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { addAgentCommand, listAgentsCommand } from './commands/agent.js';
import { createTaskCommand } from './commands/task.js';
import { startCommand } from './commands/start.js';
import { ProjectBrainImpl } from '@agent-orchestrator/core';
import React from 'react';
import { render } from 'ink';
import { TuiApp } from './tui/index.js';

const program = new Command();

program
  .name('agent-orch')
  .description('Multi-Agent Orchestration System')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize project')
  .action(async () => {
    const baseDir = process.cwd();
    await initCommand(baseDir, {
      name: 'My Project',
      description: 'Agent collaboration project',
      goal: 'Complete project goals'
    });
  });

const agentCmd = program
  .command('agent')
  .description('Manage agents');

agentCmd
  .command('add <name>')
  .description('Add new agent')
  .option('-c, --config <path>', 'Config file path')
  .action(async (name, options) => {
    const baseDir = process.cwd();
    await addAgentCommand(baseDir, name, options.config);
  });

agentCmd
  .command('list')
  .description('List all agents')
  .action(async () => {
    const baseDir = process.cwd();
    await listAgentsCommand(baseDir);
  });

program
  .command('task')
  .description('Manage tasks')
  .command('create')
  .description('Create new task')
  .action(async () => {
    const baseDir = process.cwd();
    const brain = new ProjectBrainImpl(baseDir);
    const loaded = await brain.load();
    if (!loaded) {
      console.log('No project found. Run `agent-orch init` first.');
      return;
    }
    await createTaskCommand(brain);
  });

program
  .command('start')
  .description('Start orchestration')
  .action(async () => {
    const baseDir = process.cwd();
    await startCommand(baseDir);
  });

program
  .command('tui')
  .description('Launch terminal user interface')
  .action(async () => {
    const baseDir = process.cwd();
    const brain = new ProjectBrainImpl(baseDir);
    const loaded = await brain.load();
    if (!loaded) {
      console.log('No project found. Run `agent-orch init` first.');
      return;
    }
    
    const tasks = Array.from(brain.tasks.nodes.values());
    const locks = brain.locks.active;
    
    render(React.createElement(TuiApp, {
      projectName: brain.name,
      tasks,
      agents: brain.agents,
      locks
    }));
  });

program.parse();