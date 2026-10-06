import type { ConfidenceBand, Prediction } from '../types/index';

const HIGH_CONFIDENCE = 0.9;
const UNCERTAIN_CONFIDENCE = 0.6;

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= HIGH_CONFIDENCE) return 'high';
  if (confidence >= UNCERTAIN_CONFIDENCE) return 'uncertain';
  return 'low';
}

export function confidenceLabel(band: ConfidenceBand): string {
  switch (band) {
    case 'high':
      return 'HIGH CONFIDENCE';
    case 'uncertain':
      return 'UNCERTAIN';
    case 'low':
      return 'LOW CONFIDENCE';
  }
}

export function needsHumanReview(prediction: Prediction): boolean {
  if (prediction.predictedClass === 'other' || prediction.predictedClass === 'unknown') {
    return true;
  }
  return confidenceBand(prediction.confidence) !== 'high';
}

export function buildPrediction(scores: Record<string, number>): Prediction {
  const entries = Object.entries(scores);
  if (entries.length === 0) {
    throw new Error('Prediction scores are empty');
  }

  const probabilities: Record<string, number> = {};
  for (const [label, value] of entries) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`Probability for ${label} must be a finite number between 0 and 1`);
    }
    probabilities[label] = value;
  }

  const ranked = Object.entries(probabilities).sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );
  const winner = ranked[0];
  if (!winner) {
    throw new Error('Prediction scores are empty');
  }

  return {
    predictedClass: winner[0],
    confidence: winner[1],
    probabilities: Object.fromEntries(ranked),
  };
}
