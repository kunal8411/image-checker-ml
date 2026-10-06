import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BenchmarkRunner } from '../../src/automation/benchmarkRunner';
import { createSampleGridImage } from '../../src/image/sampleImage';
import { createApp, type AppHandle } from '../../src/server/createApp';
import { FakeClassifier, testConfig } from '../helpers/app';

describe('Puppeteer benchmark', () => {
  let handle: AppHandle;
  let server: Server;
  let baseUrl = '';
  const reportPath = path.join(os.tmpdir(), `cv-benchmark-${Date.now()}.json`);
  const screenshotPath = path.join(os.tmpdir(), `cv-benchmark-${Date.now()}.png`);
  const imagePath = path.join(os.tmpdir(), `cv-sample-${Date.now()}.png`);

  beforeAll(async () => {
    await fs.writeFile(imagePath, await createSampleGridImage());
    handle = await createApp({
      config: testConfig(),
      classifier: new FakeClassifier(),
      clientMode: 'vite',
    });
    server = handle.app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind a port');
    baseUrl = `http://127.0.0.1:${String(address.port)}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await handle.close();
    await Promise.all([
      fs.rm(reportPath, { force: true }),
      fs.rm(screenshotPath, { force: true }),
      fs.rm(imagePath, { force: true }),
    ]);
  });

  it('uploads an image, analyzes a 3x3 grid, and saves a report', async () => {
    const result = await new BenchmarkRunner({
      baseUrl,
      imagePath,
      rows: 3,
      columns: 3,
      targetClass: 'car',
      reportPath,
      screenshotPath,
    }).run();

    expect(result.totalRegions).toBe(9);
    expect(result.predictions).toHaveLength(9);
    expect(result.predictions[0]?.predictedClass).toBe('car');
    expect(result.predictions[0]?.confidence).toBeGreaterThan(0.9);
    expect(result.totalInferenceTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.averageLatencyMs).toBeGreaterThanOrEqual(0);
    expect(result.clientWallClockMs).toBeGreaterThan(0);
    const saved = JSON.parse(await fs.readFile(reportPath, 'utf8')) as { totalRegions: number };
    expect(saved.totalRegions).toBe(9);
    const screenshot = await fs.stat(screenshotPath);
    expect(screenshot.size).toBeGreaterThan(1000);
  });
});
