import type { Prediction } from '../../types/index';
import { formatMs, formatPercent } from '../format';
import { ConfidenceBadge } from './ConfidenceBadge';

interface PredictionCardProps {
  prediction: Prediction;
  latencyMs: number;
}

export function PredictionCard({ prediction, latencyMs }: PredictionCardProps) {
  const topProbabilities = Object.entries(prediction.probabilities).slice(0, 4);
  return (
    <div className="prediction" data-testid="prediction-card">
      <ConfidenceBadge confidence={prediction.confidence} />
      <p>
        <span>Class</span>
        <strong data-testid="predicted-class">{prediction.predictedClass}</strong>
      </p>
      <p>
        <span>Confidence</span>
        <strong data-testid="confidence">{formatPercent(prediction.confidence)}</strong>
      </p>
      <p>
        <span>Latency</span>
        <strong data-testid="latency">{formatMs(latencyMs)}</strong>
      </p>
      <ul className="probabilities">
        {topProbabilities.map(([label, value]) => (
          <li key={label}>
            <span>{label}</span>
            <span>{formatPercent(value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
