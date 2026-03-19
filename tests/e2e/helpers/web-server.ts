import { Server } from 'http';
import express from 'express';
import { createServer } from '@agent-orchestrator/web/server';
import { ProjectBrainImpl } from '@agent-orchestrator/core';
import { getPort } from 'portfinder';

export interface WebServerContext {
  baseUrl: string;
  port: number;
  server: Server;
  app: express.Express;
}

export async function startWebServer(
  projectDir: string,
  preferredPort?: number
): Promise<WebServerContext> {
  const brain = new ProjectBrainImpl(projectDir);
  const loaded = await brain.load();
  if (!loaded) {
    throw new Error(`Failed to load brain from ${projectDir}`);
  }

  const app = createServer({ brain });
  
  const port = await new Promise<number>((resolve, reject) => {
    getPort({ port: preferredPort || 3000 }, (err, port) => {
      if (err) reject(err);
      else resolve(port);
    });
  });

  const server = await new Promise<Server>((resolve, reject) => {
    const srv = app.listen(port, () => resolve(srv));
    srv.on('error', reject);
  });

  return {
    baseUrl: `http://localhost:${port}`,
    port,
    server,
    app
  };
}

export async function stopWebServer(context: WebServerContext): Promise<void> {
  if (!context || !context.server) {
    return;
  }
  return new Promise((resolve, reject) => {
    context.server.close((err) => {
      if (err && (err as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export async function withWebServer<T>(
  projectDir: string,
  fn: (ctx: WebServerContext) => Promise<T>
): Promise<T> {
  const ctx = await startWebServer(projectDir);
  try {
    return await fn(ctx);
  } finally {
    await stopWebServer(ctx);
  }
}