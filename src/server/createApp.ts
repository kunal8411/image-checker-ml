import path from 'node:path';

import express from 'express';

import { createApiRouter, sendError, type ApiDependencies } from '../api/routes';
import type { AppConfig } from '../config';
import { AppError } from '../errors';
import { createDatasetProvider } from '../evaluation/dataset';
import type { ImageClassifier } from '../ml/classifier';
import { logEvent } from '../observability/logger';

export interface CreateAppOptions {
  config: AppConfig;
  classifier: ImageClassifier;
  clientMode: 'vite' | 'static' | 'none';
  rootDir?: string;
}

export interface AppHandle {
  app: express.Express;
  close(): Promise<void>;
}

export async function createApp(options: CreateAppOptions): Promise<AppHandle> {
  const dataset = await createDatasetProvider(options.config.datasetDir);
  const dependencies: ApiDependencies = {
    config: options.config,
    classifier: options.classifier,
    dataset: dataset.provider,
    datasetName: dataset.name,
  };

  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', createApiRouter(dependencies));

  let closeClient: (() => Promise<void>) | null = null;
  if (options.clientMode === 'vite') {
    const { createServer } = await import('vite');
    const rootDir = options.rootDir ?? process.cwd();
    const vite = await createServer({
      root: rootDir,
      configFile: path.join(rootDir, 'vite.config.ts'),
      logLevel: 'error',
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    closeClient = () => vite.close();
  } else if (options.clientMode === 'static') {
    app.use(express.static(options.config.clientDistDir));
  }

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (!(error instanceof AppError) && !(error instanceof SyntaxError)) {
      console.error(error);
    }
    if (!(error instanceof SyntaxError)) {
      const code = error instanceof Error ? error.name : 'Error';
      logEvent('request_error', { code });
    }
    sendError(error, res);
  });

  return {
    app,
    async close() {
      if (closeClient) await closeClient();
    },
  };
}
