export interface RegionReview {
  modelPrediction: string;
  humanPrediction: string | null;
  finalPrediction: string;
}

export function createReview(modelPrediction: string): RegionReview {
  return {
    modelPrediction,
    humanPrediction: null,
    finalPrediction: modelPrediction,
  };
}

export function confirmReview(review: RegionReview): RegionReview {
  return {
    ...review,
    humanPrediction: review.modelPrediction,
    finalPrediction: review.modelPrediction,
  };
}

export function changeReview(review: RegionReview, label: string): RegionReview {
  return {
    ...review,
    humanPrediction: label,
    finalPrediction: label,
  };
}
