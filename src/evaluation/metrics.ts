import { EvaluationError } from '../errors';
import type { ClassMetrics, EvaluationReport } from '../types/index';

export function calculateConfusionMatrix(
  actual: readonly string[],
  predicted: readonly string[],
  labels: readonly string[],
): number[][] {
  if (actual.length !== predicted.length) {
    throw new EvaluationError('Actual and predicted labels must have the same length');
  }

  const indexByLabel = new Map(labels.map((label, index) => [label, index]));
  const matrix = labels.map(() => labels.map(() => 0));

  for (let index = 0; index < actual.length; index += 1) {
    const actualLabel = actual[index];
    const predictedLabel = predicted[index];
    if (actualLabel === undefined || predictedLabel === undefined) {
      throw new EvaluationError('Labels are missing');
    }
    const row = indexByLabel.get(actualLabel);
    const column = indexByLabel.get(predictedLabel);
    if (row === undefined || column === undefined) {
      throw new EvaluationError('Label is not in the confusion matrix label set');
    }
    const matrixRow = matrix[row];
    if (!matrixRow) throw new EvaluationError('Confusion matrix row is missing');
    matrixRow[column] = (matrixRow[column] ?? 0) + 1;
  }

  return matrix;
}

export function calculatePrecision(matrix: readonly (readonly number[])[], classIndex: number): number {
  const truePositives = matrix[classIndex]?.[classIndex] ?? 0;
  let falsePositives = 0;
  for (let row = 0; row < matrix.length; row += 1) {
    if (row === classIndex) continue;
    falsePositives += matrix[row]?.[classIndex] ?? 0;
  }
  const denominator = truePositives + falsePositives;
  return denominator === 0 ? 0 : truePositives / denominator;
}

export function calculateRecall(matrix: readonly (readonly number[])[], classIndex: number): number {
  const truePositives = matrix[classIndex]?.[classIndex] ?? 0;
  const row = matrix[classIndex] ?? [];
  let falseNegatives = 0;
  for (let column = 0; column < row.length; column += 1) {
    if (column === classIndex) continue;
    falseNegatives += row[column] ?? 0;
  }
  const denominator = truePositives + falseNegatives;
  return denominator === 0 ? 0 : truePositives / denominator;
}

export function calculateF1(precision: number, recall: number): number {
  const sum = precision + recall;
  return sum === 0 ? 0 : (2 * precision * recall) / sum;
}

export function macroAverage(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function evaluatePredictions(
  actual: readonly string[],
  predicted: readonly string[],
): EvaluationReport {
  if (actual.length !== predicted.length) {
    throw new EvaluationError('Actual and predicted labels must have the same length');
  }

  const labels = [...new Set([...actual, ...predicted])].sort();
  const matrix = calculateConfusionMatrix(actual, predicted, labels);
  const perClass: ClassMetrics[] = labels.map((label, index) => {
    const precision = calculatePrecision(matrix, index);
    const recall = calculateRecall(matrix, index);
    const support = (matrix[index] ?? []).reduce((sum, value) => sum + value, 0);
    return {
      label,
      precision,
      recall,
      f1: calculateF1(precision, recall),
      support,
    };
  });
  const correct = actual.filter((label, index) => label === predicted[index]).length;

  return {
    perClass,
    macroPrecision: macroAverage(perClass.map((item) => item.precision)),
    macroRecall: macroAverage(perClass.map((item) => item.recall)),
    macroF1: macroAverage(perClass.map((item) => item.f1)),
    confusionMatrix: { labels, values: matrix },
    accuracy: actual.length === 0 ? 0 : correct / actual.length,
  };
}
