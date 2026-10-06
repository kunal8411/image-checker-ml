import fs from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ModelManager } from '../src/ml/modelLoader';
import { loadTensorflowModel, TensorflowImageClassifier } from '../src/ml/tensorflowClassifier';
import { CATEGORIES } from '../src/types/index';
import { solidPng } from './helpers/images';

const modelDir = path.join(process.cwd(), 'models', 'mobilenet');
const modelReady = async () => {
  try {
    const stat = await fs.stat(path.join(modelDir, 'model.json'));
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
};

describe('TensorflowImageClassifier', () => {
  it('scores a batch with the pretrained model when weights are present', async () => {
    if (!(await modelReady())) {
      return;
    }
    const manager = new ModelManager(() => loadTensorflowModel(modelDir));
    const classifier = new TensorflowImageClassifier(manager);
    try {
      const image = await solidPng(96, 96, { r: 180, g: 40, b: 40 });
      const detailed = await classifier.classifyDetailed([image, image]);
      expect(detailed.regions).toHaveLength(2);
      expect(detailed.batched).toBe(true);
      for (const region of detailed.regions) {
        expect(region.prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(region.prediction.confidence).toBeLessThanOrEqual(1);
        expect(region.sourceLabel.length).toBeGreaterThan(0);
        const total = Object.values(region.prediction.probabilities).reduce((sum, value) => sum + value, 0);
        expect(total).toBeCloseTo(1, 5);
        expect(region.prediction.probabilities[region.prediction.predictedClass]).toBeCloseTo(
          region.prediction.confidence,
        );
      }
      const again = await classifier.classify(image);
      expect(again.predictedClass.length).toBeGreaterThan(0);
      expect(CATEGORIES.includes('car')).toBe(true);
    } finally {
      await manager.dispose();
    }
  });
});
