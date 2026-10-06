import fs from 'node:fs/promises';
import path from 'node:path';

import { ModelInitializationError } from '../errors';
import { mapClassName } from './labelMap';

const MODEL_BASE_URL = 'https://tfhub.dev/google/imagenet/mobilenet_v2_050_224/classification/2/';
const MODEL_JSON_URL = `${MODEL_BASE_URL}model.json?tfjs-format=file`;
const LABELS_URL =
  'https://raw.githubusercontent.com/tensorflow/tfjs-models/master/mobilenet/src/imagenet_classes.ts';

const REQUIRED_FILES = ['model.json', 'group1-shard1of2.bin', 'group1-shard2of2.bin', 'labels.json'];

export async function ensureLocalModel(modelDir: string): Promise<void> {
  if (await modelFilesReady(modelDir)) return;
  await downloadMobileNet(modelDir);
  if (!(await modelFilesReady(modelDir))) {
    throw new ModelInitializationError(
      'MobileNet files are still missing after download. Run npm run model:download.',
    );
  }
}

export async function downloadMobileNet(modelDir: string): Promise<void> {
  await fs.mkdir(modelDir, { recursive: true });
  const modelJsonBytes = await fetchBytes(MODEL_JSON_URL);
  const parsed: unknown = JSON.parse(modelJsonBytes.toString('utf8'));
  if (!isModelManifest(parsed)) {
    throw new ModelInitializationError('Downloaded model manifest was not a TensorFlow.js graph model');
  }

  await fs.writeFile(path.join(modelDir, 'model.json'), modelJsonBytes);
  for (const group of parsed.weightsManifest) {
    for (const relativePath of group.paths) {
      assertRelativeWeightPath(relativePath);
      const url = new URL(relativePath, MODEL_BASE_URL);
      url.searchParams.set('tfjs-format', 'file');
      const bytes = await fetchBytes(url.toString());
      await fs.writeFile(path.join(modelDir, relativePath), bytes);
    }
  }

  const labelsSource = (await fetchBytes(LABELS_URL)).toString('utf8');
  const labels = parseImagenetClasses(labelsSource);
  await fs.writeFile(path.join(modelDir, 'labels.json'), JSON.stringify(labels));
}

export function parseImagenetClasses(source: string): string[] {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const match = withoutComments.match(/=\s*(\{[\s\S]*\})\s*;?\s*$/);
  const literal = match?.[1];
  if (!literal) throw new ModelInitializationError('Could not parse ImageNet labels');
  if (/`|->|=>|\bfunction\b|\bimport\b|\bprocess\b|\brequire\b|\beval\b/.test(literal)) {
    throw new ModelInitializationError('ImageNet label file contained unexpected syntax');
  }

  const factory = new Function(`return ${literal}`) as () => unknown;
  const record = factory();
  if (typeof record !== 'object' || record === null) {
    throw new ModelInitializationError('ImageNet label file did not contain a class map');
  }

  const labels: string[] = [];
  const entries = record as Record<string, unknown>;
  for (let index = 0; index < 1000; index += 1) {
    const value = entries[String(index)];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new ModelInitializationError(`ImageNet label ${String(index)} is missing`);
    }
    labels.push(value);
  }
  return labels;
}

export function summarizeLabelMap(labels: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const label of labels) {
    const category = mapClassName(label);
    counts[category] = (counts[category] ?? 0) + 1;
  }
  return counts;
}

async function modelFilesReady(modelDir: string): Promise<boolean> {
  try {
    await Promise.all(
      REQUIRED_FILES.map(async (fileName) => {
        const stat = await fs.stat(path.join(modelDir, fileName));
        if (!stat.isFile() || stat.size === 0) throw new Error('incomplete');
      }),
    );
    return true;
  } catch {
    return false;
  }
}

async function fetchBytes(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    throw new ModelInitializationError(`Could not download model file (${String(response.status)})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function assertRelativeWeightPath(relativePath: string): void {
  if (
    relativePath.length === 0 ||
    relativePath.includes('..') ||
    relativePath.includes('\\') ||
    path.isAbsolute(relativePath) ||
    relativePath.includes('\0')
  ) {
    throw new ModelInitializationError('Model weight path is invalid');
  }
}

function isModelManifest(value: unknown): value is { weightsManifest: { paths: string[] }[] } {
  if (typeof value !== 'object' || value === null) return false;
  const manifest = (value as { weightsManifest?: unknown }).weightsManifest;
  if (!Array.isArray(manifest)) return false;
  return manifest.every((group) => {
    if (typeof group !== 'object' || group === null) return false;
    const paths = (group as { paths?: unknown }).paths;
    return Array.isArray(paths) && paths.every((item) => typeof item === 'string');
  });
}
