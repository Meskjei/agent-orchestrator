import { spawn } from 'child_process';
import * as path from 'path';

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const CLI_PATH = path.resolve(__dirname, '../../../packages/cli/dist/index.js');

export async function runCli(
  args: string[],
  options?: { cwd?: string; timeout?: number }
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const timeout = options?.timeout || 30000;
    let stdout = '';
    let stderr = '';

    const child = spawn('node', [CLI_PATH, ...args], {
      cwd: options?.cwd || process.cwd(),
      env: { ...process.env, NODE_NO_WARNINGS: '1' }
    });

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      child.kill();
      reject(new Error(`CLI timeout after ${timeout}ms`));
    }, timeout);

    child.on('close', (code) => {
      if (settled) return;
      clearTimeout(timer);
      resolve({
        exitCode: code || 0,
        stdout,
        stderr
      });
    });

    child.on('error', (err) => {
      if (settled) return;
      clearTimeout(timer);
      reject(err);
    });
  });
}

export async function runCliExpectSuccess(
  args: string[],
  options?: { cwd?: string }
): Promise<CliResult> {
  const result = await runCli(args, options);
  if (result.exitCode !== 0) {
    throw new Error(
      `CLI failed with exit code ${result.exitCode}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
    );
  }
  return result;
}

export async function runCliExpectFailure(
  args: string[],
  options?: { cwd?: string }
): Promise<CliResult> {
  const result = await runCli(args, options);
  if (result.exitCode === 0) {
    throw new Error(`CLI succeeded but expected failure\nstdout: ${result.stdout}`);
  }
  return result;
}