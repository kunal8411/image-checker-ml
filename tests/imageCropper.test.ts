import { describe, expect, it } from 'vitest';

import { cropImageIntoRegions, tileSpan } from '../src/image/imageCropper';
import { decodeRgb } from '../src/image/imageLoader';
import { gradientPng, solidPng } from './helpers/images';

describe('cropImageIntoRegions', () => {
  it('splits a 3x3 grid without gaps or overlap', async () => {
    const png = await gradientPng(90, 90);
    const regions = await cropImageIntoRegions(png, { rows: 3, columns: 3 });
    expect(regions).toHaveLength(9);
    expect(regions.map((region) => region.id)).toEqual([
      'region-1',
      'region-2',
      'region-3',
      'region-4',
      'region-5',
      'region-6',
      'region-7',
      'region-8',
      'region-9',
    ]);
    await expectExactCoverage(png, regions, 3, 3);
  });

  it('splits a 4x4 grid', async () => {
    const png = await gradientPng(32, 32);
    const regions = await cropImageIntoRegions(png, { rows: 4, columns: 4 });
    expect(regions).toHaveLength(16);
    await expectExactCoverage(png, regions, 4, 4);
  });

  it('keeps every pixel on odd and non-square images', async () => {
    const png = await gradientPng(11, 13);
    const regions = await cropImageIntoRegions(png, { rows: 3, columns: 3 });
    expect(tileSpan(11, 3, 0).size + tileSpan(11, 3, 1).size + tileSpan(11, 3, 2).size).toBe(11);
    expect(tileSpan(13, 3, 0).size + tileSpan(13, 3, 1).size + tileSpan(13, 3, 2).size).toBe(13);
    await expectExactCoverage(png, regions, 3, 3);

    const wide = await gradientPng(101, 41);
    const wideRegions = await cropImageIntoRegions(wide, { rows: 4, columns: 4 });
    expect(wideRegions).toHaveLength(16);
    await expectExactCoverage(wide, wideRegions, 4, 4);
  });

  it('covers a 1x1 grid with the whole image', async () => {
    const png = await solidPng(15, 10, { r: 9, g: 8, b: 7 });
    const regions = await cropImageIntoRegions(png, { rows: 1, columns: 1 });
    expect(regions).toHaveLength(1);
    await expectExactCoverage(png, regions, 1, 1);
  });

  it('rejects invalid grids and images that are smaller than the grid', async () => {
    const png = await solidPng(2, 2);
    await expect(cropImageIntoRegions(png, { rows: 0, columns: 3 })).rejects.toThrow(/rows/);
    await expect(cropImageIntoRegions(png, { rows: 3, columns: 1.5 })).rejects.toThrow(/columns/);
    await expect(cropImageIntoRegions(Buffer.alloc(0), { rows: 1, columns: 1 })).rejects.toThrow(/empty/);
    await expect(cropImageIntoRegions(png, { rows: 3, columns: 3 })).rejects.toThrow(/empty regions/);
  });
});

async function expectExactCoverage(
  png: Buffer,
  regions: Awaited<ReturnType<typeof cropImageIntoRegions>>,
  rows: number,
  columns: number,
): Promise<void> {
  const source = await decodeRgb(png);
  const rebuilt = Buffer.alloc(source.rgb.length);
  const seen = Buffer.alloc(source.width * source.height);

  for (const region of regions) {
    const decoded = await decodeRgb(region.image);
    const vertical = tileSpan(source.height, rows, region.row);
    const horizontal = tileSpan(source.width, columns, region.column);
    expect(decoded.width).toBe(horizontal.size);
    expect(decoded.height).toBe(vertical.size);

    for (let y = 0; y < decoded.height; y += 1) {
      for (let x = 0; x < decoded.width; x += 1) {
        const target = (vertical.offset + y) * source.width + horizontal.offset + x;
        expect(seen[target]).toBe(0);
        seen[target] = 1;
        const from = (y * decoded.width + x) * 3;
        const to = target * 3;
        rebuilt[to] = decoded.rgb[from] ?? 0;
        rebuilt[to + 1] = decoded.rgb[from + 1] ?? 0;
        rebuilt[to + 2] = decoded.rgb[from + 2] ?? 0;
      }
    }
  }

  expect(seen.every((value) => value === 1)).toBe(true);
  expect(Buffer.compare(rebuilt, source.rgb)).toBe(0);
}
