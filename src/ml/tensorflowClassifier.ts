import fs from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';
import '@tensorflow/tfjs-backend-cpu';
import * as tf from '@tensorflow/tfjs';

import { ClassificationError } from '../errors';
import { logEvent } from '../observability/logger';
import type { Prediction } from '../types/index';
import type { ClassificationDetail, DetailedBatch, ImageClassifier } from './classifier';
import { ensureLocalModel } from './downloadModel';
import { aggregateCategoryScores } from './labelMap';
import { modelLoadFailure, ModelManager } from './modelLoader';
import { buildPrediction } from './prediction';

export interface LoadedVisionModel {
  graph: tf.GraphModel;
  labels: string[];
  inputSize: number;
  dispose(): void;
}

let backendReady: Promise<void> | null = null;

async function ensureBackend(): Promise<void> {
  if (!backendReady) {
    backendReady = (async () => {
      await tf.setBackend('cpu');
      await tf.ready();
      tf.enableProdMode();
    })();
  }
  await backendReady;
}

export async function loadTensorflowModel(modelDir: string): Promise<LoadedVisionModel> {
  try {
    await ensureBackend();
    await ensureLocalModel(modelDir);
    const graph = await tf.loadGraphModel(localGraphModelIO(modelDir));
    const labels = await readLabels(modelDir);
    const inputSize = readInputSize(graph);
    await warmup(graph, inputSize);
    return {
      graph,
      labels,
      inputSize,
      dispose() {
        graph.dispose();
      },
    };
  } catch (error) {
    throw modelLoadFailure(error);
  }
}

export class TensorflowImageClassifier implements ImageClassifier {
  constructor(private readonly models: ModelManager<LoadedVisionModel>) {}

  async initialize(): Promise<void> {
    await this.models.initialize();
  }

  async classify(image: Buffer): Promise<Prediction> {
    const [prediction] = await this.classifyBatch([image]);
    if (!prediction) throw new ClassificationError('Model returned no prediction');
    return prediction;
  }

  async classifyBatch(images: Buffer[]): Promise<Prediction[]> {
    const detailed = await this.classifyDetailed(images);
    return detailed.regions.map((region) => region.prediction);
  }

  async classifyDetailed(images: Buffer[]): Promise<DetailedBatch> {
    if (images.length === 0) return { regions: [], batched: true };
    if (images.length > 64) throw new ClassificationError('Batch is too large');
    await this.models.initialize();
    const loaded = this.models.getModel();

    try {
      return { regions: await this.predictFused(loaded, images), batched: true };
    } catch (error) {
      if (images.length === 1) {
        throw new ClassificationError('Model inference failed', { cause: error });
      }
      logEvent('inference_fallback', {
        regionCount: images.length,
        message: error instanceof Error ? error.message : 'fused batch failed',
      });
      const regions: ClassificationDetail[] = [];
      for (const image of images) {
        try {
          const [region] = await this.predictFused(loaded, [image]);
          if (!region) throw new ClassificationError('Model returned no prediction');
          regions.push(region);
        } catch (innerError) {
          throw new ClassificationError('Model inference failed', { cause: innerError });
        }
      }
      return { regions, batched: false };
    }
  }

  private async predictFused(loaded: LoadedVisionModel, images: Buffer[]): Promise<ClassificationDetail[]> {
    const tensors: tf.Tensor[] = [];
    let batch: tf.Tensor | null = null;
    let raw: tf.Tensor | null = null;
    let matrix: tf.Tensor | null = null;
    let sliced: tf.Tensor | null = null;
    let probabilities: tf.Tensor | null = null;

    try {
      for (const image of images) {
        tensors.push(await imageToTensor(image, loaded.inputSize));
      }
      batch = tf.stack(tensors);
      raw = await executeGraph(loaded.graph, batch);
      const classCount = raw.size / images.length;
      if (!Number.isInteger(classCount) || classCount < 2) {
        throw new ClassificationError('Unexpected model output shape');
      }

      matrix = raw.reshape([images.length, classCount]);
      let rowWidth = classCount;
      let logits = matrix;
      if (classCount === loaded.labels.length + 1) {
        sliced = matrix.slice([0, 1], [images.length, loaded.labels.length]);
        logits = sliced;
        rowWidth = loaded.labels.length;
      } else if (classCount !== loaded.labels.length) {
        throw new ClassificationError(
          `Model returned ${String(classCount)} classes; the label file has ${String(loaded.labels.length)}`,
        );
      }

      probabilities = logits.softmax(1);
      const values = Float32Array.from(await probabilities.data());
      return images.map((_, index) => {
        const start = index * rowWidth;
        const entries = loaded.labels.map((className, classIndex) => ({
          className,
          probability: values[start + classIndex] ?? 0,
        }));
        const aggregated = aggregateCategoryScores(entries);
        return {
          prediction: buildPrediction(aggregated.scores),
          sourceLabel: aggregated.sourceLabel,
        };
      });
    } finally {
      for (const tensor of tensors) tensor.dispose();
      batch?.dispose();
      raw?.dispose();
      matrix?.dispose();
      sliced?.dispose();
      probabilities?.dispose();
    }
  }
}

async function imageToTensor(image: Buffer, size: number): Promise<tf.Tensor3D> {
  const { data, info } = await sharp(image, { failOn: 'error' })
    .resize(size, size, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 3 || info.width !== size || info.height !== size) {
    throw new ClassificationError('Could not decode a model input tensor');
  }
  const floats = new Float32Array(data.length);
  for (let index = 0; index < data.length; index += 1) {
    floats[index] = (data[index] ?? 0) / 255;
  }
  return tf.tensor3d(floats, [size, size, 3]);
}

async function executeGraph(graph: tf.GraphModel, batch: tf.Tensor): Promise<tf.Tensor> {
  const inputName = graph.inputs[0]?.name;
  try {
    return unwrapTensor(graph.predict(batch));
  } catch (error) {
    if (!inputName) throw error;
    return unwrapTensor(await graph.executeAsync({ [inputName]: batch }));
  }
}

function unwrapTensor(value: unknown): tf.Tensor {
  if (isTensor(value)) return value;
  if (Array.isArray(value)) {
    const first = value.find(isTensor);
    if (first) return first;
  }
  if (typeof value === 'object' && value !== null) {
    const first = Object.values(value).find(isTensor);
    if (first) return first;
  }
  throw new ClassificationError('Model returned an empty output');
}

function isTensor(value: unknown): value is tf.Tensor {
  return (
    typeof value === 'object' &&
    value !== null &&
    'size' in value &&
    'reshape' in value &&
    'dispose' in value &&
    'data' in value
  );
}

function localGraphModelIO(modelDir: string): tf.io.IOHandler {
  return {
    load: async () => {
      const modelJsonPath = path.join(modelDir, 'model.json');
      const parsed: unknown = JSON.parse(await fs.readFile(modelJsonPath, 'utf8'));
      if (typeof parsed !== 'object' || parsed === null) {
        throw new ClassificationError('Model manifest is invalid');
      }
      const record = parsed as {
        modelTopology?: unknown;
        weightsManifest?: { paths?: unknown; weights?: tf.io.WeightsManifestEntry[] }[];
        format?: string;
        generatedBy?: string;
        convertedBy?: string;
      };
      const groups = record.weightsManifest ?? [];
      const weightSpecs: tf.io.WeightsManifestEntry[] = [];
      const chunks: Buffer[] = [];
      for (const group of groups) {
        if (group.weights) weightSpecs.push(...group.weights);
        const paths = Array.isArray(group.paths) ? group.paths : [];
        for (const relativePath of paths) {
          if (typeof relativePath !== 'string') {
            throw new ClassificationError('Model weight path is invalid');
          }
          chunks.push(await readWeight(modelDir, relativePath));
        }
      }
      const weightData = bufferToArrayBuffer(Buffer.concat(chunks));
      return {
        modelTopology: record.modelTopology,
        weightSpecs,
        weightData,
        format: record.format,
        generatedBy: record.generatedBy,
        convertedBy: record.convertedBy,
      } as tf.io.ModelArtifacts;
    },
  };
}

async function readWeight(modelDir: string, relativePath: string): Promise<Buffer> {
  if (relativePath.includes('..') || path.isAbsolute(relativePath) || relativePath.includes('\0')) {
    throw new ClassificationError('Model weight path is invalid');
  }
  const root = path.resolve(modelDir);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new ClassificationError('Model weight path is invalid');
  }
  return fs.readFile(resolved);
}

async function readLabels(modelDir: string): Promise<string[]> {
  const parsed: unknown = JSON.parse(await fs.readFile(path.join(modelDir, 'labels.json'), 'utf8'));
  if (!Array.isArray(parsed) || parsed.length !== 1000 || parsed.some((label) => typeof label !== 'string')) {
    throw new ClassificationError('Model labels are missing or incomplete');
  }
  return parsed as string[];
}

function readInputSize(graph: tf.GraphModel): number {
  const shape = graph.inputs[0]?.shape ?? [];
  const height = shape[1];
  const width = shape[2];
  if (typeof height === 'number' && height > 0 && height === width) return height;
  return 224;
}

async function warmup(graph: tf.GraphModel, inputSize: number): Promise<void> {
  const zeros = tf.zeros([1, inputSize, inputSize, 3]);
  let output: tf.Tensor | null = null;
  try {
    output = await executeGraph(graph, zeros);
    await output.data();
  } finally {
    zeros.dispose();
    output?.dispose();
  }
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const copy = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(copy).set(buffer);
  return copy;
}
