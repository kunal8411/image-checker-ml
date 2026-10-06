import { describe, expect, it } from 'vitest';

import { aggregateCategoryScores, mapClassName } from '../src/ml/labelMap';
import { buildPrediction, confidenceBand, needsHumanReview } from '../src/ml/prediction';

describe('predictions', () => {
  it('builds a schema whose confidence is the winning probability', () => {
    const prediction = buildPrediction({
      car: 0.942,
      bus: 0.031,
      bicycle: 0.014,
      tree: 0.013,
    });
    expect(prediction).toEqual({
      predictedClass: 'car',
      confidence: 0.942,
      probabilities: {
        car: 0.942,
        bus: 0.031,
        bicycle: 0.014,
        tree: 0.013,
      },
    });
  });

  it('rejects probabilities outside 0 to 1', () => {
    expect(() => buildPrediction({ car: 1.2 })).toThrow(/between 0 and 1/);
    expect(() => buildPrediction({ car: Number.NaN })).toThrow(/finite/);
  });

  it('classifies confidence bands at the documented boundaries', () => {
    expect(confidenceBand(0.9)).toBe('high');
    expect(confidenceBand(0.899)).toBe('uncertain');
    expect(confidenceBand(0.6)).toBe('uncertain');
    expect(confidenceBand(0.599)).toBe('low');
    const low = buildPrediction({ bicycle: 0.42, other: 0.2 });
    expect(needsHumanReview(low)).toBe(true);
    const other = buildPrediction({ other: 0.97, car: 0.01 });
    expect(needsHumanReview(other)).toBe(true);
    const high = buildPrediction({ car: 0.95, bus: 0.05 });
    expect(needsHumanReview(high)).toBe(false);
  });

  it('maps ImageNet names without treating lookalike words as vehicles', () => {
    expect(mapClassName('sports car, sport car')).toBe('car');
    expect(mapClassName('cab, hack, taxi, taxicab')).toBe('car');
    expect(mapClassName('cabbage')).toBe('other');
    expect(mapClassName('minibus')).toBe('bus');
    expect(mapClassName('school bus')).toBe('bus');
    expect(mapClassName('moped')).toBe('motorcycle');
    expect(mapClassName('mountain bike, all-terrain bike, off-roader')).toBe('bicycle');
    expect(mapClassName('traffic light, traffic signal, stoplight')).toBe('traffic-light');
    expect(mapClassName('tabby, tabby cat')).toBe('other');

    const aggregated = aggregateCategoryScores([
      { className: 'sports car, sport car', probability: 0.7 },
      { className: 'minibus', probability: 0.2 },
      { className: 'tabby, tabby cat', probability: 0.1 },
    ]);
    expect(aggregated.sourceLabel).toContain('sports car');
    expect(aggregated.scores.car).toBeCloseTo(0.7);
    expect(aggregated.scores.bus).toBeCloseTo(0.2);
    expect(aggregated.scores.other).toBeCloseTo(0.1);
  });
});
