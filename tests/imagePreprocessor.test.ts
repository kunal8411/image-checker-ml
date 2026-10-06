import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { SharpImagePreprocessor } from '../src/image/imagePreprocessor';
import { solidPng } from './helpers/images';

describe('SharpImagePreprocessor', () => {
  it('resizes and leaves sharpening and contrast off unless asked', async () => {
    const input = await solidPng(30, 18, { r: 40, g: 90, b: 120 });
    const preprocessor = new SharpImagePreprocessor({
      width: 64,
      height: 48,
      normalize: false,
      sharpen: false,
      contrast: 1,
    });
    const output = await preprocessor.preprocess(input);
    const meta = await sharp(output).metadata();
    expect(meta.width).toBe(64);
    expect(meta.height).toBe(48);
    expect(meta.format).toBe('png');
  });

  it('applies optional normalize, sharpen, and mild contrast', async () => {
    const input = await solidPng(20, 20, { r: 10, g: 200, b: 30 });
    const preprocessor = new SharpImagePreprocessor({
      width: 32,
      height: 32,
      normalize: true,
      sharpen: true,
      contrast: 1.2,
    });
    const output = await preprocessor.preprocess(input);
    const meta = await sharp(output).metadata();
    expect(meta.width).toBe(32);
    expect(meta.height).toBe(32);
  });

  it('rejects empty images and extreme contrast', async () => {
    const preprocessor = new SharpImagePreprocessor({
      width: 16,
      height: 16,
      normalize: false,
      sharpen: false,
      contrast: 1,
    });
    await expect(preprocessor.preprocess(Buffer.alloc(0))).rejects.toThrow(/empty/);
    expect(
      () =>
        new SharpImagePreprocessor({
          width: 16,
          height: 16,
          normalize: false,
          sharpen: false,
          contrast: 3,
        }),
    ).toThrow(/Contrast/);
  });
});
