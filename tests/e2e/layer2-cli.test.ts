import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createTempProject, cleanupTempProject } from './helpers/fixture';
import { runCli, runCliExpectSuccess, runCliExpectFailure } from './helpers/cli-runner';
import { assertBrainPersisted, assertDirectoryStructure } from './helpers/assertions';

describe('Layer 2 - CLI Commands', () => {
  let project: Awaited<ReturnType<typeof createTempProject>>;

  beforeEach(async () => {
    project = await createTempProject('cli-test');
  });

  afterEach(async () => {
    await cleanupTempProject(project);
  });

  describe('L2-01: init command', () => {
    it('should create .agent-orch directory with config files', async () => {
      const result = await runCli(['init'], { cwd: project.dir });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Created .agent-orch/config.yaml');
      expect(result.stdout).toContain('Created .agent-orch/brain.json');
      expect(result.stdout).toContain('Created .agent-orch/agents/');
      
      await assertDirectoryStructure(project.dir, [
        '.agent-orch',
        '.agent-orch/config.yaml',
        '.agent-orch/brain.json',
        '.agent-orch/agents'
      ]);
    });

    it('should create valid brain.json structure', async () => {
      await runCliExpectSuccess(['init'], { cwd: project.dir });
      
      const brainContent = await fs.readFile(project.brainPath, 'utf-8');
      const brain = JSON.parse(brainContent);
      
      expect(brain).toHaveProperty('id');
      expect(brain).toHaveProperty('name');
      expect(brain).toHaveProperty('version');
      expect(brain).toHaveProperty('goal');
      expect(brain).toHaveProperty('agents');
      expect(brain).toHaveProperty('tasks');
      expect(brain).toHaveProperty('context');
      expect(brain).toHaveProperty('decisions');
      expect(brain).toHaveProperty('locks');
      expect(brain.agents).toEqual([]);
    });

    it('should create valid config.yaml', async () => {
      await runCliExpectSuccess(['init'], { cwd: project.dir });
      
      const configContent = await fs.readFile(project.configPath, 'utf-8');
      
      expect(configContent).toContain('name:');
      expect(configContent).toContain('description:');
      expect(configContent).toContain('goal:');
      expect(configContent).toContain('version:');
    });
  });

  describe('L2-02: init duplicate handling', () => {
    it('should allow re-initialization and overwrite existing files', async () => {
      await runCliExpectSuccess(['init'], { cwd: project.dir });
      
      const originalBrain = await fs.readFile(project.brainPath, 'utf-8');
      
      await runCliExpectSuccess(['init'], { cwd: project.dir });
      
      const newBrain = await fs.readFile(project.brainPath, 'utf-8');
      
      expect(newBrain).toBeDefined();
      expect(JSON.parse(newBrain)).toHaveProperty('id');
    });

    it('should preserve directory structure on re-init', async () => {
      await runCliExpectSuccess(['init'], { cwd: project.dir });
      
      await fs.writeFile(
        path.join(project.dir, '.agent-orch', 'agents', 'test-agent.json'),
        JSON.stringify({ name: 'test' })
      );
      
      await runCliExpectSuccess(['init'], { cwd: project.dir });
      
      const agentFile = path.join(project.dir, '.agent-orch', 'agents', 'test-agent.json');
      const exists = await fs.access(agentFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('L2-03: agent add command', () => {
    beforeEach(async () => {
      await runCliExpectSuccess(['init'], { cwd: project.dir });
    });

    it('should register a new agent', async () => {
      const result = await runCli(['agent', 'add', 'developer'], { cwd: project.dir });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Agent "developer" registered');
      
      const agentPath = path.join(project.dir, '.agent-orch', 'agents', 'developer.json');
      const agentConfig = JSON.parse(await fs.readFile(agentPath, 'utf-8'));
      
      expect(agentConfig.name).toBe('developer');
      expect(agentConfig.description).toBe('developer agent');
      expect(agentConfig.type).toBe('cli');
    });

    it('should create agent with config file', async () => {
      const configPath = path.join(project.dir, 'agent-config.json');
      await fs.writeFile(configPath, JSON.stringify({
        name: 'custom-agent',
        description: 'Custom agent description',
        type: 'api',
        endpoint: 'http://localhost:3000',
        skills: ['coding', 'testing']
      }));
      
      const result = await runCli(['agent', 'add', 'custom', '-c', configPath], { cwd: project.dir });
      
      expect(result.exitCode).toBe(0);
      
      const agentPath = path.join(project.dir, '.agent-orch', 'agents', 'custom.json');
      const agentConfig = JSON.parse(await fs.readFile(agentPath, 'utf-8'));
      
      expect(agentConfig.name).toBe('custom-agent');
      expect(agentConfig.endpoint).toBe('http://localhost:3000');
      expect(agentConfig.skills).toContain('coding');
    });

    it('should overwrite existing agent with same name', async () => {
      await runCliExpectSuccess(['agent', 'add', 'test-agent'], { cwd: project.dir });
      
      const result = await runCli(['agent', 'add', 'test-agent'], { cwd: project.dir });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Agent "test-agent" registered');
    });
  });

  describe('L2-04 & L2-05: agent list command', () => {
    beforeEach(async () => {
      await runCliExpectSuccess(['init'], { cwd: project.dir });
    });

    it('should show empty list when no agents', async () => {
      const result = await runCli(['agent', 'list'], { cwd: project.dir });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No agents registered');
    });

    it('should list all registered agents', async () => {
      await runCliExpectSuccess(['agent', 'add', 'agent-one'], { cwd: project.dir });
      await runCliExpectSuccess(['agent', 'add', 'agent-two'], { cwd: project.dir });
      
      const result = await runCli(['agent', 'list'], { cwd: project.dir });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('agent-one');
      expect(result.stdout).toContain('agent-two');
    });

    it('should show agent descriptions', async () => {
      const configPath = path.join(project.dir, 'config.json');
      await fs.writeFile(configPath, JSON.stringify({
        name: 'special-agent',
        description: 'A special agent for testing',
        type: 'cli',
        skills: []
      }));
      
      await runCliExpectSuccess(['agent', 'add', 'special', '-c', configPath], { cwd: project.dir });
      
      const result = await runCli(['agent', 'list'], { cwd: project.dir });
      
      expect(result.stdout).toContain('special-agent');
      expect(result.stdout).toContain('A special agent for testing');
    });

    it('should handle missing agents directory gracefully', async () => {
      await fs.rm(path.join(project.dir, '.agent-orch', 'agents'), { recursive: true });
      
      const result = await runCli(['agent', 'list'], { cwd: project.dir });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No agents registered');
    });
  });

  describe('L2-06 & L2-07: task create command', () => {
    beforeEach(async () => {
      await runCliExpectSuccess(['init'], { cwd: project.dir });
    });

    it('should fail when project not initialized', async () => {
      const emptyProject = await createTempProject('empty');
      
      try {
        const result = await runCli(['task', 'create'], { cwd: emptyProject.dir });
        
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('No project found');
      } finally {
        await cleanupTempProject(emptyProject);
      }
    });

    it('should create task with default values', async () => {
      const result = await runCli(['task', 'create'], { cwd: project.dir });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Task T001 created');
      
      await assertBrainPersisted(project.dir, { taskCount: 1 });
    });

    it('should increment task IDs for multiple tasks', async () => {
      await runCliExpectSuccess(['task', 'create'], { cwd: project.dir });
      await runCliExpectSuccess(['task', 'create'], { cwd: project.dir });
      const result = await runCliExpectSuccess(['task', 'create'], { cwd: project.dir });
      
      expect(result.stdout).toContain('Task T003');
      
      await assertBrainPersisted(project.dir, { taskCount: 3 });
    });

    it('should persist task with correct structure', async () => {
      await runCliExpectSuccess(['task', 'create'], { cwd: project.dir });
      
      const brainContent = await fs.readFile(project.brainPath, 'utf-8');
      const brain = JSON.parse(brainContent);
      
      const nodesArray = brain.tasks.nodes;
      expect(nodesArray).toHaveLength(1);
      
      const [taskId, task] = nodesArray[0];
      expect(taskId).toBe('T001');
      expect(task).toHaveProperty('id');
      expect(task).toHaveProperty('title');
      expect(task).toHaveProperty('description');
      expect(task).toHaveProperty('status');
      expect(task.status).toBe('pending');
      expect(task).toHaveProperty('statusHistory');
      expect(task.statusHistory.length).toBe(1);
      expect(task.statusHistory[0].status).toBe('pending');
    });
  });

  describe('L2-08 & L2-09: start command', () => {
    beforeEach(async () => {
      await runCliExpectSuccess(['init'], { cwd: project.dir });
    });

    it('should fail when project not initialized', async () => {
      const emptyProject = await createTempProject('empty');
      
      try {
        const result = await runCli(['start'], { cwd: emptyProject.dir });
        
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('No project found');
      } finally {
        await cleanupTempProject(emptyProject);
      }
    });

    it('should start orchestrator and show project info', async () => {
      const result = await runCli(['start'], { cwd: project.dir });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Starting Orchestrator Agent');
      expect(result.stdout).toContain('Project:');
      expect(result.stdout).toContain('Agents: 0');
      expect(result.stdout).toContain('Tasks: 0');
      expect(result.stdout).toContain('Orchestrator started');
    });

    it('should show correct task counts', async () => {
      await runCliExpectSuccess(['task', 'create'], { cwd: project.dir });
      await runCliExpectSuccess(['task', 'create'], { cwd: project.dir });
      
      const result = await runCli(['start'], { cwd: project.dir });
      
      expect(result.stdout).toContain('Tasks: 2');
    });
  });

  describe('L2-10: help command', () => {
    it('should show help for main command', async () => {
      const result = await runCli(['--help'], { cwd: project.dir });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Multi-Agent Orchestration System');
      expect(result.stdout).toContain('init');
      expect(result.stdout).toContain('agent');
      expect(result.stdout).toContain('task');
      expect(result.stdout).toContain('start');
    });

    it('should show help for agent subcommands', async () => {
      const result = await runCli(['agent', '--help'], { cwd: project.dir });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('add');
      expect(result.stdout).toContain('list');
    });

    it('should show help for task subcommands', async () => {
      const result = await runCli(['task', '--help'], { cwd: project.dir });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('create');
    });

    it('should show version', async () => {
      const result = await runCli(['--version'], { cwd: project.dir });
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });
});