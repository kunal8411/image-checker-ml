import type { RegionView } from '../../types/index';
import type { RegionReview } from '../reviewState';
import { HumanReviewPanel } from './HumanReviewPanel';
import { PredictionCard } from './PredictionCard';

interface RegionCardProps {
  region: RegionView;
  review: RegionReview;
  matchesTarget: boolean;
  onConfirm: () => void;
  onChange: (label: string) => void;
}

export function RegionCard({ region, review, matchesTarget, onConfirm, onChange }: RegionCardProps) {
  const className = [
    'region-card',
    region.needsReview ? 'needs-review' : '',
    matchesTarget ? 'matches-target' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      className={className}
      data-testid="region-card"
      data-region-id={region.id}
      data-prediction={JSON.stringify(region.prediction)}
    >
      <img src={region.previewDataUrl} alt="" />
      <header>
        <h3 data-testid="region-id">Region {region.id.replace('region-', '')}</h3>
        <p className="source-label">ImageNet: {region.sourceLabel}</p>
      </header>
      <PredictionCard prediction={region.prediction} latencyMs={region.latencyMs} />
      <HumanReviewPanel
        key={`${region.id}-${review.finalPrediction}`}
        review={review}
        needsReview={region.needsReview}
        onConfirm={onConfirm}
        onChange={onChange}
      />
    </article>
  );
}
