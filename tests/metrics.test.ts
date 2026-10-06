import { describe, expect, it } from 'vitest';

import {
  calculateConfusionMatrix,
  calculateF1,
  calculatePrecision,
  calculateRecall,
  evaluatePredictions,
  macroAverage,
} from '../src/evaluation/metrics';

describe('evaluation metrics', () => {
  const actual = ['car', 'car', 'bus', 'bicycle'];
  const predicted = ['car', 'bus', 'bus', 'bicycle'];

  it('builds a confusion matrix and per-class precision, recall, and F1', () => {
    const labels = ['bicycle', 'bus', 'car'];
    const matrix = calculateConfusionMatrix(actual, predicted, labels);
    expect(matrix).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 1, 1],
    ]);

    const bicycle = 0;
    const bus = 1;
    const car = 2;
    expect(calculatePrecision(matrix, car)).toBeCloseTo(1);
    expect(calculateRecall(matrix, car)).toBeCloseTo(0.5);
    expect(calculateF1(1, 0.5)).toBeCloseTo(2 / 3);
    expect(calculatePrecision(matrix, bus)).toBeCloseTo(0.5);
    expect(calculateRecall(matrix, bus)).toBeCloseTo(1);
    expect(calculatePrecision(matrix, bicycle)).toBeCloseTo(1);
    expect(calculateRecall(matrix, bicycle)).toBeCloseTo(1);

    const report = evaluatePredictions(actual, predicted);
    expect(report.accuracy).toBeCloseTo(0.75);
    expect(report.macroPrecision).toBeCloseTo(macroAverage([1, 0.5, 1]));
    expect(report.macroRecall).toBeCloseTo(macroAverage([1, 1, 0.5]));
    expect(report.perClass.map((row) => row.label)).toEqual(labels);
    expect(report.confusionMatrix.values).toEqual(matrix);
  });

  it('returns zero for empty positive or negative support instead of dividing by zero', () => {
    const matrix = [
      [0, 0],
      [0, 0],
    ];
    expect(calculatePrecision(matrix, 0)).toBe(0);
    expect(calculateRecall(matrix, 0)).toBe(0);
    expect(calculateF1(0, 0)).toBe(0);
    expect(macroAverage([])).toBe(0);
  });

  it('rejects mismatched label lists', () => {
    expect(() => calculateConfusionMatrix(['car'], ['car', 'bus'], ['car', 'bus'])).toThrow(/same length/);
  });
});
