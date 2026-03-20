import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ACPClientAdapter } from '@agent-orchestrator/adapter';

export interface ACPTestProject {
  dir: string;
  adapter: ACPClientAdapter;
  cleanup: () => Promise<void>;
}

export async function createACPTestProject(name: string): Promise<ACPTestProject> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `acp-test-${name}-`));
  
  const adapter = new ACPClientAdapter({
    name: 'opencode',
    command: 'opencode',
    args: ['acp'],
    cwd: dir,
    timeout: 90000
  });

  return {
    dir,
    adapter,
    cleanup: async () => {
      await adapter.cancel();
      await fs.rm(dir, { recursive: true, force: true });
    }
  };
}

export async function createTestFile(projectDir: string, filename: string, content: string): Promise<string> {
  const filePath = path.join(projectDir, filename);
  await fs.writeFile(filePath, content);
  return filePath;
}