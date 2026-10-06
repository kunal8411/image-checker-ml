import path from 'node:path';

import type { PreprocessingConfig } from './types/index';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  maxUploadBytes: number;
  maxImageDimension: number;
  maxGridSize: number;
  modelDir: string;
  clientDistDir: string;
  datasetDir: string | null;
  preprocessing: PreprocessingConfig;
}

function parsePositiveInt(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseContrast(value: string | undefined): number {
  if (value === undefined || value === '') return 1;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0.5 || parsed > 2) {
    throw new Error('PREPROCESS_CONTRAST must be between 0.5 and 2');
  }
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const datasetDir = env.DATASET_DIR?.trim() ? env.DATASET_DIR.trim() : null;
  return {
    port: parsePositiveInt(env.PORT, 3000, 'PORT'),
    nodeEnv: env.NODE_ENV ?? 'development',
    maxUploadBytes: parsePositiveInt(env.MAX_UPLOAD_BYTES, 8 * 1024 * 1024, 'MAX_UPLOAD_BYTES'),
    maxImageDimension: parsePositiveInt(env.MAX_IMAGE_DIMENSION, 8192, 'MAX_IMAGE_DIMENSION'),
    maxGridSize: 4,
    modelDir: env.MODEL_DIR ? path.resolve(env.MODEL_DIR) : path.join(process.cwd(), 'models', 'mobilenet'),
    clientDistDir: path.join(process.cwd(), 'dist', 'client'),
    datasetDir: datasetDir ? path.resolve(datasetDir) : null,
    preprocessing: {
      width: parsePositiveInt(env.PREPROCESS_WIDTH, 224, 'PREPROCESS_WIDTH'),
      height: parsePositiveInt(env.PREPROCESS_HEIGHT, 224, 'PREPROCESS_HEIGHT'),
      normalize: env.PREPROCESS_NORMALIZE === 'true',
      sharpen: env.PREPROCESS_SHARPEN === 'true',
      contrast: parseContrast(env.PREPROCESS_CONTRAST),
    },
  };
}
