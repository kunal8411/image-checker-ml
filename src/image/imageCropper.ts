import sharp from 'sharp';

import { InvalidImageError, InvalidRequestError } from '../errors';
import type { GridConfig, ImageRegion } from '../types/index';
import { decodeRgb } from './imageLoader';

export function tileSpan(total: number, count: number, index: number): { offset: number; size: number } {
  const offset = Math.floor((index * total) / count);
  const end = Math.floor(((index + 1) * total) / count);
  return { offset, size: end - offset };
}

function assertGridAxis(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1 || value > 32) {
    throw new InvalidRequestError(`${name} must be a whole number between 1 and 32`);
  }
}

export async function cropImageIntoRegions(image: Buffer, config: GridConfig): Promise<ImageRegion[]> {
  assertGridAxis(config.rows, 'rows');
  assertGridAxis(config.columns, 'columns');

  const decoded = await decodeRgb(image);
  if (decoded.width < config.columns || decoded.height < config.rows) {
    throw new InvalidImageError(
      `Image is ${decoded.width}×${decoded.height} and cannot be split into a ${config.rows}×${config.columns} grid without empty regions`,
    );
  }

  const regions: ImageRegion[] = [];
  let index = 0;
  for (let row = 0; row < config.rows; row += 1) {
    const vertical = tileSpan(decoded.height, config.rows, row);
    for (let column = 0; column < config.columns; column += 1) {
      const horizontal = tileSpan(decoded.width, config.columns, column);
      if (horizontal.size < 1 || vertical.size < 1) {
        throw new InvalidImageError('Grid produced an empty region');
      }

      const slice = Buffer.alloc(horizontal.size * vertical.size * 3);
      for (let y = 0; y < vertical.size; y += 1) {
        const sourceStart = ((vertical.offset + y) * decoded.width + horizontal.offset) * 3;
        decoded.rgb.copy(slice, y * horizontal.size * 3, sourceStart, sourceStart + horizontal.size * 3);
      }

      const encoded = await sharp(slice, {
        raw: { width: horizontal.size, height: vertical.size, channels: 3 },
      })
        .png()
        .toBuffer();

      index += 1;
      regions.push({
        id: `region-${index}`,
        row,
        column,
        image: encoded,
      });
    }
  }

  return regions;
}
