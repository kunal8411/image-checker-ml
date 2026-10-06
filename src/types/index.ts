export const CATEGORIES = [
  'car',
  'bicycle',
  'bus',
  'motorcycle',
  'traffic-light',
  'tree',
  'building',
] as const;

export type VisualCategory = (typeof CATEGORIES)[number];

export type ConfidenceBand = 'high' | 'uncertain' | 'low';

export interface GridConfig {
  rows: number;
  columns: number;
}

export interface ImageRegion {
  id: string;
  row: number;
  column: number;
  image: Buffer;
}

export interface PreprocessingConfig {
  width: number;
  height: number;
  normalize: boolean;
  sharpen: boolean;
  contrast: number;
}

export interface Prediction {
  predictedClass: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface ImageSample {
  imagePath: string;
  label: string;
}

export interface DatasetProvider {
  getTrainingSamples(): Promise<ImageSample[]>;
  getValidationSamples(): Promise<ImageSample[]>;
  getTestSamples(): Promise<ImageSample[]>;
}

export interface ImageQuality {
  score: number;
  isLowQuality: boolean;
}

export interface ImageQualityReport extends ImageQuality {
  width: number;
  height: number;
  brightness: number;
  contrast: number;
  sharpness: number;
}

export interface RegionView {
  id: string;
  row: number;
  column: number;
  previewDataUrl: string;
  prediction: Prediction;
  latencyMs: number;
  sourceLabel: string;
  needsReview: boolean;
}

export interface LatencyReport {
  cropMs: number;
  preprocessingMs: number;
  inferenceMs: number;
  previewMs: number;
  qualityMs: number;
  totalMs: number;
  averageRegionLatencyMs: number;
  regionCount: number;
  batched: boolean;
}

export interface ClassMetrics {
  label: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface EvaluationReport {
  perClass: ClassMetrics[];
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  confusionMatrix: {
    labels: string[];
    values: number[][];
  };
  accuracy: number;
}

export interface AnalyzeResponse {
  regions: RegionView[];
  predictions: Prediction[];
  metrics: EvaluationReport | null;
  latency: LatencyReport;
  quality: ImageQualityReport;
  rows: number;
  columns: number;
}

export interface EvaluationItem {
  actual: string;
  predicted: string;
}

export interface BenchmarkResult {
  totalRegions: number;
  totalInferenceTimeMs: number;
  averageLatencyMs: number;
  predictions: Prediction[];
  preprocessingMs: number;
  inferenceMs: number;
  totalMs: number;
  clientWallClockMs: number;
  screenshotPath: string;
  reportPath: string;
}
