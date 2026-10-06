import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  FileDatasetProvider,
  MockDatasetProvider,
  sharedGroupIds,
  splitDatasetByGroup,
} from '../src/evaluation/dataset';
import type { ImageSample } from '../src/types/index';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('dataset splits', () => {
  it('keeps near-duplicate groups inside a single 70/15/15 split', async () => {
    const provider = new MockDatasetProvider();
    const [train, validation, test] = await Promise.all([
      provider.getTrainingSamples(),
      provider.getValidationSamples(),
      provider.getTestSamples(),
    ]);

    expect(sharedGroupIds(train, validation)).toEqual([]);
    expect(sharedGroupIds(train, test)).toEqual([]);
    expect(sharedGroupIds(validation, test)).toEqual([]);
    expect(train.length + validation.length + test.length).toBe(40);
    expect(train.length).toBe(28);
    expect(validation.length).toBe(6);
    expect(test.length).toBe(6);

    const manual = splitDatasetByGroup([
      { imagePath: 'scenes/alpha/1.png', label: 'car' },
      { imagePath: 'scenes/alpha/2.png', label: 'car' },
      { imagePath: 'scenes/beta/1.png', label: 'bus' },
    ]);
    const alphaSplit = splitName(manual, 'alpha');
    expect(manual[alphaSplit].map((sample) => sample.imagePath)).toEqual([
      'scenes/alpha/1.png',
      'scenes/alpha/2.png',
    ]);
  });

  it('reads a local folder dataset and rejects paths outside the root', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cv-dataset-'));
    tempDirs.push(root);
    await writeSample(root, 'train', 'car', 'one.png');
    await writeSample(root, 'validation', 'bus', 'two.png');
    await writeSample(root, 'test', 'tree', 'three.png');

    const provider = await FileDatasetProvider.open(root);
    expect(await provider.getTrainingSamples()).toHaveLength(1);
    expect(await provider.getValidationSamples()).toHaveLength(1);
    expect((await provider.getTestSamples())[0]?.label).toBe('tree');

    const outside = path.resolve(root, 'train', 'car', '..', '..', '..', 'escaped.png');
    expect(outside.startsWith(root + path.sep)).toBe(false);
  });
});

function splitName(
  splits: { train: ImageSample[]; validation: ImageSample[]; test: ImageSample[] },
  group: string,
): 'train' | 'validation' | 'test' {
  if (splits.train.some((sample) => sample.imagePath.includes(group))) return 'train';
  if (splits.validation.some((sample) => sample.imagePath.includes(group))) return 'validation';
  return 'test';
}

async function writeSample(root: string, split: string, label: string, fileName: string): Promise<void> {
  const dir = path.join(root, split, label);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, fileName), Buffer.from('not-decoded'));
}
