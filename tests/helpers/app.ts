import path from 'node:path';

import type { AppConfig } from '../../src/config';
import type { ImageClassifier } from '../../src/ml/classifier';
import { buildPrediction } from '../../src/ml/prediction';
import { CATEGORIES, type Prediction } from '../../src/types/index';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const preprocessing = {
    width: 32,
    height: 32,
    normalize: false,
    sharpen: false,
    contrast: 1,
    ...overrides.preprocessing,
  };
  return {
    port: 0,
    nodeEnv: 'test',
    maxUploadBytes: 8 * 1024 * 1024,
    maxImageDimension: 8192,
    maxGridSize: 4,
    modelDir: path.join(process.cwd(), 'models', 'mobilenet'),
    clientDistDir: path.join(process.cwd(), 'dist', 'client'),
    datasetDir: null,
    ...overrides,
    preprocessing,
  };
}

export class FakeClassifier implements ImageClassifier {
  async initialize(): Promise<void> {}

  async classify(image: Buffer): Promise<Prediction> {
    const [prediction] = await this.classifyBatch([image]);
    if (!prediction) throw new Error('Missing prediction');
    return prediction;
  }

  async classifyBatch(images: Buffer[]): Promise<Prediction[]> {
    return images.map((_, index) => fakePrediction(index));
  }
}

export function fakePrediction(index: number): Prediction {
  const predictedClass = index % 2 === 0 ? 'car' : 'tree';
  const confidence = index === 0 ? 0.94 : index === 4 ? 0.68 : 0.42;
  const labels = [...CATEGORIES, 'other'];
  const rest = (1 - confidence) / (labels.length - 1);
  const scores: Record<string, number> = {};
  for (const label of labels) {
    scores[label] = label === predictedClass ? confidence : rest;
  }
  return buildPrediction(scores);
}
