import { useState } from 'react';

import { CATEGORIES } from '../../types/index';
import type { RegionReview } from '../reviewState';

interface HumanReviewPanelProps {
  review: RegionReview;
  needsReview: boolean;
  onConfirm: () => void;
  onChange: (label: string) => void;
}

export function HumanReviewPanel({ review, needsReview, onConfirm, onChange }: HumanReviewPanelProps) {
  const initial = CATEGORIES.includes(review.finalPrediction as (typeof CATEGORIES)[number])
    ? review.finalPrediction
    : CATEGORIES[0];
  const [draft, setDraft] = useState(initial);

  return (
    <div className="review" data-testid="human-review">
      {needsReview ? <p className="review-note">This prediction needs a human check.</p> : null}
      <p>
        <span>Model</span>
        <strong data-testid="model-prediction">{review.modelPrediction}</strong>
      </p>
      <p>
        <span>Human</span>
        <strong data-testid="human-prediction">{review.humanPrediction ?? 'pending'}</strong>
      </p>
      <p>
        <span>Final</span>
        <strong data-testid="final-prediction">{review.finalPrediction}</strong>
      </p>
      <div className="review-actions">
        <button type="button" data-testid="confirm-button" onClick={onConfirm}>
          Confirm
        </button>
        <label>
          Change Class
          <select data-testid="change-class" value={draft} onChange={(event) => setDraft(event.target.value)}>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <button type="button" data-testid="change-class-button" onClick={() => onChange(draft)}>
          Change Class
        </button>
      </div>
    </div>
  );
}
