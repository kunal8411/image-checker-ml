import { describe, expect, it } from 'vitest';

import { changeReview, confirmReview, createReview } from '../src/client/reviewState';

describe('human review state', () => {
  it('stores the model label, the human label, and the final label', () => {
    const initial = createReview('car');
    expect(initial).toEqual({
      modelPrediction: 'car',
      humanPrediction: null,
      finalPrediction: 'car',
    });

    expect(confirmReview(initial)).toEqual({
      modelPrediction: 'car',
      humanPrediction: 'car',
      finalPrediction: 'car',
    });

    expect(changeReview(initial, 'bus')).toEqual({
      modelPrediction: 'car',
      humanPrediction: 'bus',
      finalPrediction: 'bus',
    });
  });
});
