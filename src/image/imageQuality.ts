import sharp from 'sharp';

import { InvalidImageError } from '../errors';
import type { ImageQualityReport } from '../types/index';

export async function analyzeImageQuality(image: Buffer): Promise<ImageQualityReport> {
  if (image.length === 0) throw new InvalidImageError('Image file is empty');

  try {
    const meta = await sharp(image, { failOn: 'error' }).rotate().metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    const { data, info } = await sharp(image, { failOn: 'error' })
      .rotate()
      .greyscale()
      .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const brightness = mean(data);
    const contrast = standardDeviation(data, brightness);
    const sharpness =
      info.width > 2 && info.height > 2 ? laplacianVariance(data, info.width, info.height) : 0;
    const minDimension = Math.min(width, height);
    const sizeScore = clamp(minDimension / 128);
    const brightnessScore = 1 - clamp(Math.abs(brightness - 128) / 128);
    const contrastScore = clamp(contrast / 40);
    const sharpnessScore = clamp(sharpness / 80);
    const score = round3(0.25 * sizeScore + 0.2 * brightnessScore + 0.25 * contrastScore + 0.3 * sharpnessScore);
    const isLowQuality = minDimension < 32 || sharpness < 12 || contrast < 6 || score < 0.4;

    return {
      score,
      isLowQuality,
      width,
      height,
      brightness: round3(brightness),
      contrast: round3(contrast),
      sharpness: round3(sharpness),
    };
  } catch (error) {
    if (error instanceof InvalidImageError) throw error;
    throw new InvalidImageError('Image quality could not be measured', { cause: error });
  }
}

function mean(values: Buffer): number {
  if (values.length === 0) return 0;
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

function standardDeviation(values: Buffer, average: number): number {
  if (values.length === 0) return 0;
  let squareSum = 0;
  for (const value of values) {
    const delta = value - average;
    squareSum += delta * delta;
  }
  return Math.sqrt(squareSum / values.length);
}

function laplacianVariance(gray: Buffer, width: number, height: number): number {
  let sum = 0;
  let squareSum = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const value =
        -4 * (gray[index] ?? 0) +
        (gray[index - 1] ?? 0) +
        (gray[index + 1] ?? 0) +
        (gray[index - width] ?? 0) +
        (gray[index + width] ?? 0);
      sum += value;
      squareSum += value * value;
      count += 1;
    }
  }
  if (count === 0) return 0;
  const average = sum / count;
  return squareSum / count - average * average;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
