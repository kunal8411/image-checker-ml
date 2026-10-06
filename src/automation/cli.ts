import fs from 'node:fs/promises';
import path from 'node:path';

import { createSampleGridImage } from '../image/sampleImage';
import { BenchmarkRunner } from './benchmarkRunner';

const args = parseArgs(process.argv.slice(2));
const imagePath = args.image ?? path.join(process.cwd(), 'fixtures', 'sample-grid.png');
const grid = args.grid === '4' ? 4 : 3;

await fs.mkdir(path.dirname(imagePath), { recursive: true });
try {
  await fs.access(imagePath);
} catch {
  await fs.writeFile(imagePath, await createSampleGridImage());
}

await waitForHealth(args.url);
const runner = new BenchmarkRunner({
  baseUrl: args.url,
  imagePath,
  rows: grid,
  columns: grid,
  targetClass: args.target,
  reportPath: path.join(process.cwd(), 'reports', 'benchmark-report.json'),
  screenshotPath: path.join(process.cwd(), 'reports', 'benchmark-screenshot.png'),
});
const result = await runner.run();
console.log(
  JSON.stringify(
    {
      event: 'benchmark_complete',
      totalRegions: result.totalRegions,
      totalInferenceTimeMs: result.totalInferenceTimeMs,
      averageLatencyMs: result.averageLatencyMs,
      preprocessingMs: result.preprocessingMs,
      totalMs: result.totalMs,
      clientWallClockMs: result.clientWallClockMs,
      reportPath: result.reportPath,
    },
    null,
    2,
  ),
);

function parseArgs(argv: string[]): { url: string; image?: string; grid: string; target: string } {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (value && !value.startsWith('--')) {
      values.set(key, value);
      index += 1;
    }
  }
  return {
    url: values.get('url') ?? 'http://localhost:3000',
    image: values.get('image'),
    grid: values.get('grid') ?? '3',
    target: values.get('target') ?? 'car',
  };
}

async function waitForHealth(url: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(new URL('/api/health', url));
      if (response.ok) return;
    } catch {
      // The server may still be loading the model.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Local application did not become ready at /api/health');
}
