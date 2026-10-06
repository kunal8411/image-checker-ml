import type { Prediction } from '../types/index';

export interface ImageClassifier {
  initialize(): Promise<void>;
  classify(image: Buffer): Promise<Prediction>;
  classifyBatch(images: Buffer[]): Promise<Prediction[]>;
}

export interface ClassificationDetail {
  prediction: Prediction;
  sourceLabel: string;
}

export interface DetailedBatch {
  regions: ClassificationDetail[];
  batched: boolean;
}
