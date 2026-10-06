import fs from 'node:fs/promises';
import path from 'node:path';

import { logEvent } from '../observability/logger';
import { CATEGORIES, type DatasetProvider, type ImageSample } from '../types/index';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export function groupIdOf(sample: ImageSample): string {
  const parts = sample.imagePath.split(/[/\\]/).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2] ?? sample.imagePath;
  return sample.imagePath;
}

export function splitDatasetByGroup(samples: readonly ImageSample[]): {
  train: ImageSample[];
  validation: ImageSample[];
  test: ImageSample[];
} {
  const groups = new Map<string, ImageSample[]>();
  for (const sample of samples) {
    const id = groupIdOf(sample);
    const existing = groups.get(id);
    if (existing) existing.push(sample);
    else groups.set(id, [sample]);
  }

  const ids = [...groups.keys()];
  const trainGroupCount = Math.round(ids.length * 0.7);
  const validationGroupCount = Math.round(ids.length * 0.15);
  const trainIds = new Set(ids.slice(0, trainGroupCount));
  const validationIds = new Set(ids.slice(trainGroupCount, trainGroupCount + validationGroupCount));
  const train: ImageSample[] = [];
  const validation: ImageSample[] = [];
  const test: ImageSample[] = [];

  for (const [id, group] of groups) {
    const bucket = trainIds.has(id) ? train : validationIds.has(id) ? validation : test;
    bucket.push(...group);
  }

  return { train, validation, test };
}

export function sharedGroupIds(left: readonly ImageSample[], right: readonly ImageSample[]): string[] {
  const leftIds = new Set(left.map(groupIdOf));
  return [...new Set(right.map(groupIdOf).filter((id) => leftIds.has(id)))];
}

function buildMockSamples(): ImageSample[] {
  const samples: ImageSample[] = [];
  for (let group = 0; group < 20; group += 1) {
    const label = CATEGORIES[group % CATEGORIES.length] ?? 'car';
    for (let copy = 0; copy < 2; copy += 1) {
      samples.push({
        imagePath: `mock/scene-${group}/view-${copy}.png`,
        label,
      });
    }
  }
  return samples;
}

export class MockDatasetProvider implements DatasetProvider {
  private readonly splits: ReturnType<typeof splitDatasetByGroup>;

  constructor(samples: readonly ImageSample[] = buildMockSamples()) {
    this.splits = splitDatasetByGroup(samples);
  }

  async getTrainingSamples(): Promise<ImageSample[]> {
    return this.splits.train;
  }

  async getValidationSamples(): Promise<ImageSample[]> {
    return this.splits.validation;
  }

  async getTestSamples(): Promise<ImageSample[]> {
    return this.splits.test;
  }
}

export class FileDatasetProvider implements DatasetProvider {
  private constructor(
    private readonly splits: {
      train: ImageSample[];
      validation: ImageSample[];
      test: ImageSample[];
    },
  ) {}

  static async open(rootDir: string): Promise<FileDatasetProvider> {
    const realRoot = await fs.realpath(rootDir);
    const [train, validation, test] = await Promise.all([
      readSplit(realRoot, 'train'),
      readSplit(realRoot, 'validation'),
      readSplit(realRoot, 'test'),
    ]);
    return new FileDatasetProvider({ train, validation, test });
  }

  async getTrainingSamples(): Promise<ImageSample[]> {
    return this.splits.train;
  }

  async getValidationSamples(): Promise<ImageSample[]> {
    return this.splits.validation;
  }

  async getTestSamples(): Promise<ImageSample[]> {
    return this.splits.test;
  }
}

async function readSplit(rootDir: string, split: string): Promise<ImageSample[]> {
  const splitDir = path.resolve(rootDir, split);
  await assertInside(rootDir, splitDir);
  const labels = await fs.readdir(splitDir, { withFileTypes: true });
  const samples: ImageSample[] = [];

  for (const labelEntry of labels) {
    if (!labelEntry.isDirectory()) continue;
    if (!/^[\w.-]+$/.test(labelEntry.name) || labelEntry.name.includes('..')) {
      throw new Error(`Invalid label directory: ${labelEntry.name}`);
    }
    const labelDir = path.resolve(splitDir, labelEntry.name);
    await assertInside(rootDir, labelDir);
    const files = await fs.readdir(labelDir, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile()) continue;
      const extension = path.extname(file.name).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(extension)) continue;
      const filePath = path.resolve(labelDir, file.name);
      await assertInside(rootDir, filePath);
      const realFile = await fs.realpath(filePath);
      await assertInside(rootDir, realFile);
      samples.push({ imagePath: realFile, label: labelEntry.name });
    }
  }

  return samples;
}

async function assertInside(rootDir: string, candidate: string): Promise<void> {
  const root = await fs.realpath(rootDir);
  const resolved = path.resolve(candidate);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('Dataset path escapes the dataset root');
  }
}

export async function createDatasetProvider(datasetDir: string | null): Promise<{
  provider: DatasetProvider;
  name: 'files' | 'mock';
}> {
  if (datasetDir) {
    try {
      const provider = await FileDatasetProvider.open(datasetDir);
      return { provider, name: 'files' };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Dataset directory is unavailable';
      logEvent('dataset_fallback', { reason });
      return {
        provider: new MockDatasetProvider(),
        name: 'mock',
      };
    }
  }
  return { provider: new MockDatasetProvider(), name: 'mock' };
}
