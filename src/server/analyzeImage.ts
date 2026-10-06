import { ClassificationError } from '../errors';
import { createPreviewDataUrl } from '../image/imageLoader';
import { cropImageIntoRegions } from '../image/imageCropper';
import { SharpImagePreprocessor } from '../image/imagePreprocessor';
import { analyzeImageQuality } from '../image/imageQuality';
import type { ClassificationDetail, DetailedBatch, ImageClassifier } from '../ml/classifier';
import { needsHumanReview } from '../ml/prediction';
import { logEvent } from '../observability/logger';
import type { AnalyzeResponse, PreprocessingConfig } from '../types/index';

interface DetailedClassifier extends ImageClassifier {
  classifyDetailed(images: Buffer[]): Promise<DetailedBatch>;
}

export async function analyzeImage(input: {
  image: Buffer;
  rows: number;
  columns: number;
  classifier: ImageClassifier;
  preprocessing: PreprocessingConfig;
}): Promise<AnalyzeResponse> {
  const started = performance.now();
  const qualityStarted = performance.now();
  const quality = await analyzeImageQuality(input.image);
  const qualityMs = elapsed(qualityStarted);

  const cropStarted = performance.now();
  const regions = await cropImageIntoRegions(input.image, {
    rows: input.rows,
    columns: input.columns,
  });
  const cropMs = elapsed(cropStarted);

  const preprocessor = new SharpImagePreprocessor(input.preprocessing);
  const preprocessStarted = performance.now();
  const preprocessed = await Promise.all(regions.map((region) => preprocessor.preprocess(region.image)));
  const preprocessingMs = elapsed(preprocessStarted);

  const inferenceStarted = performance.now();
  const detailed = await classifyRegions(input.classifier, preprocessed);
  const inferenceMs = elapsed(inferenceStarted);

  const previewStarted = performance.now();
  const previews = await Promise.all(regions.map((region) => createPreviewDataUrl(region.image)));
  const previewMs = elapsed(previewStarted);

  const totalMs = elapsed(started);
  const averageRegionLatencyMs = regions.length === 0 ? 0 : inferenceMs / regions.length;
  const latency = {
    cropMs,
    preprocessingMs,
    inferenceMs,
    previewMs,
    qualityMs,
    totalMs,
    averageRegionLatencyMs,
    regionCount: regions.length,
    batched: detailed.batched,
  };

  logEvent('image_analysis', {
    regionCount: regions.length,
    preprocessingMs,
    inferenceMs,
    totalMs,
    batched: detailed.batched,
    lowQuality: quality.isLowQuality,
  });

  return {
    rows: input.rows,
    columns: input.columns,
    quality,
    metrics: null,
    latency,
    predictions: detailed.regions.map((region) => region.prediction),
    regions: regions.map((region, index) => {
      const detail = detailed.regions[index];
      const prediction = detail?.prediction;
      if (!prediction || !detail) {
        throw new ClassificationError('Classification count did not match the cropped regions');
      }
      return {
        id: region.id,
        row: region.row,
        column: region.column,
        previewDataUrl: previews[index] ?? '',
        prediction,
        latencyMs: averageRegionLatencyMs,
        sourceLabel: detail.sourceLabel,
        needsReview: needsHumanReview(prediction),
      };
    }),
  };
}

async function classifyRegions(classifier: ImageClassifier, images: Buffer[]): Promise<DetailedBatch> {
  if (isDetailedClassifier(classifier)) {
    return classifier.classifyDetailed(images);
  }
  const predictions = await classifier.classifyBatch(images);
  const regions: ClassificationDetail[] = predictions.map((prediction) => ({
    prediction,
    sourceLabel: prediction.predictedClass,
  }));
  return { regions, batched: true };
}

function isDetailedClassifier(classifier: ImageClassifier): classifier is DetailedClassifier {
  return 'classifyDetailed' in classifier && typeof classifier.classifyDetailed === 'function';
}

function elapsed(started: number): number {
  return Math.round((performance.now() - started) * 10) / 10;
}
