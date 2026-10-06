import express from 'express';
import multer from 'multer';

import { parseEvaluationItems, parseGridDimension, readFormField } from './validation';
import { AppError, InvalidRequestError, PayloadTooLargeError } from '../errors';
import { assertMimeMatchesExtension, assertSafeFilename, readImageInfo } from '../image/imageLoader';
import { evaluatePredictions } from '../evaluation/metrics';
import type { ImageClassifier } from '../ml/classifier';
import type { AppConfig } from '../config';
import type { DatasetProvider } from '../types/index';
import { analyzeImage } from '../server/analyzeImage';

export interface ApiDependencies {
  config: AppConfig;
  classifier: ImageClassifier;
  dataset: DatasetProvider;
  datasetName: 'files' | 'mock';
}

export function createApiRouter(deps: ApiDependencies): express.Router {
  const router = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: deps.config.maxUploadBytes, files: 1 },
  });

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get(
    '/dataset',
    asyncHandler(async (_req, res) => {
      const [training, validation, test] = await Promise.all([
        deps.dataset.getTrainingSamples(),
        deps.dataset.getValidationSamples(),
        deps.dataset.getTestSamples(),
      ]);
      res.json({
        provider: deps.datasetName,
        trainingSamples: training.length,
        validationSamples: validation.length,
        testSamples: test.length,
        split: { train: 0.7, validation: 0.15, test: 0.15 },
        note:
          deps.datasetName === 'mock'
            ? 'Using the built-in mock dataset. Point DATASET_DIR at a local train/validation/test folder to use your own images. Near-duplicate groups stay inside one split.'
            : 'Using the local dataset directory. Paths are confined to that directory.',
      });
    }),
  );

  router.post(
    '/analyze',
    (req, res, next) => {
      upload.single('image')(req, res, (error) => {
        if (error) {
          next(mapUploadError(error, deps.config.maxUploadBytes));
          return;
        }
        next();
      });
    },
    asyncHandler(async (req, res) => {
      const file = req.file;
      if (!file) throw new InvalidRequestError('Image file is required');
      assertSafeFilename(file.originalname);
      const rows = parseGridDimension(readFormField(req.body, 'rows'), 'rows', deps.config.maxGridSize);
      const columns = parseGridDimension(
        readFormField(req.body, 'columns'),
        'columns',
        deps.config.maxGridSize,
      );
      const info = await readImageInfo(file.buffer, { maxDimension: deps.config.maxImageDimension });
      assertMimeMatchesExtension(file.originalname, info.mime);
      if (info.width < columns || info.height < rows) {
        throw new InvalidRequestError(
          `Image is ${String(info.width)}×${String(info.height)}, which is smaller than the requested grid`,
        );
      }

      const result = await analyzeImage({
        image: file.buffer,
        rows,
        columns,
        classifier: deps.classifier,
        preprocessing: deps.config.preprocessing,
      });
      res.json(result);
    }),
  );

  router.post(
    '/evaluate',
    asyncHandler(async (req, res) => {
      const items = parseEvaluationItems(req.body);
      const report = evaluatePredictions(
        items.map((item) => item.actual),
        items.map((item) => item.predicted),
      );
      res.json(report);
    }),
  );

  return router;
}

function mapUploadError(error: unknown, maxUploadBytes: number): unknown {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new PayloadTooLargeError(`Image exceeds the ${String(maxUploadBytes)} byte upload limit`);
    }
    return new InvalidRequestError('Invalid upload');
  }
  return error;
}

function asyncHandler(
  handler: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>,
): express.RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function sendError(error: unknown, res: express.Response): void {
  if (res.headersSent) return;
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message, code: error.code });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: 'Malformed JSON', code: 'invalid_request' });
    return;
  }
  res.status(500).json({ error: 'Internal server error', code: 'internal_error' });
}
