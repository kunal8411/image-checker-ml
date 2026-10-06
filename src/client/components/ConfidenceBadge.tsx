import { confidenceBand, confidenceLabel } from '../../ml/prediction';

interface ConfidenceBadgeProps {
  confidence: number;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const band = confidenceBand(confidence);
  return (
    <span className={`badge badge-${band}`} data-testid="confidence-badge">
      {confidenceLabel(band)}
    </span>
  );
}
