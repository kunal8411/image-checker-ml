import { describe, expect, it } from 'vitest';

import { analyzeImageQuality } from '../src/image/imageQuality';
import { noisePng, solidPng } from './helpers/images';

describe('analyzeImageQuality', () => {
  it('flags tiny or flat images and accepts a textured image', async () => {
    const tiny = await analyzeImageQuality(await solidPng(8, 8));
    expect(tiny.isLowQuality).toBe(true);

    const flat = await analyzeImageQuality(await solidPng(180, 140, { r: 128, g: 128, b: 128 }));
    expect(flat.isLowQuality).toBe(true);
    expect(flat.sharpness).toBe(0);

    const textured = await analyzeImageQuality(await noisePng(180, 140));
    expect(textured.isLowQuality).toBe(false);
    expect(textured.score).toBeGreaterThan(0.4);
    expect(textured.score).toBeLessThanOrEqual(1);
  });
});
