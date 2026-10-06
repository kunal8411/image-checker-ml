import sharp from 'sharp';

import { ImageTooLargeError, InvalidImageError, InvalidRequestError } from '../errors';

export type AllowedMime = 'image/png' | 'image/jpeg' | 'image/webp';

export interface ImageInfo {
  mime: AllowedMime;
  width: number;
  height: number;
  format: string;
}

export interface DecodedRgb {
  width: number;
  height: number;
  rgb: Buffer;
}

const EXTENSIONS: Record<AllowedMime, string[]> = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};

export function detectImageMime(buffer: Buffer): AllowedMime | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export function assertSafeFilename(filename: string): void {
  if (!filename || filename.length > 255 || filename !== filename.normalize()) {
    throw new InvalidRequestError('Invalid file name');
  }
  if (
    filename.includes('..') ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('\0')
  ) {
    throw new InvalidRequestError('Invalid file name');
  }
}

export function assertMimeMatchesExtension(filename: string, mime: AllowedMime): void {
  const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  if (!EXTENSIONS[mime].includes(extension)) {
    throw new InvalidImageError('File extension does not match the image contents');
  }
}

export async function readImageInfo(
  buffer: Buffer,
  limits: { maxDimension: number },
): Promise<ImageInfo> {
  if (buffer.length === 0) throw new InvalidImageError('Image file is empty');
  const mime = detectImageMime(buffer);
  if (!mime) throw new InvalidImageError('Unsupported or unrecognized image format');

  try {
    const meta = await sharp(buffer, {
      failOn: 'error',
      limitInputPixels: 16384 * 16384,
      animated: false,
    }).metadata();
    if (!meta.width || !meta.height) {
      throw new InvalidImageError('Image dimensions are missing');
    }
    if (meta.width > limits.maxDimension || meta.height > limits.maxDimension) {
      throw new ImageTooLargeError(`Image dimensions exceed ${limits.maxDimension}px on a side`);
    }
    if ((meta.pages ?? 1) > 1) {
      throw new InvalidImageError('Animated images are not supported');
    }
    return {
      mime,
      width: meta.width,
      height: meta.height,
      format: meta.format ?? 'unknown',
    };
  } catch (error) {
    if (error instanceof InvalidImageError || error instanceof ImageTooLargeError) throw error;
    if (error instanceof Error && /pixel limit/i.test(error.message)) {
      throw new ImageTooLargeError('Image exceeds the pixel limit');
    }
    throw new InvalidImageError('Image file is corrupted or unreadable', { cause: error });
  }
}

export async function decodeRgb(image: Buffer): Promise<DecodedRgb> {
  if (image.length === 0) throw new InvalidImageError('Image file is empty');
  try {
    const { data, info } = await sharp(image, {
      failOn: 'error',
      limitInputPixels: 8192 * 8192,
      animated: false,
    })
      .rotate()
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .toColorspace('srgb')
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (!info.width || !info.height) {
      throw new InvalidImageError('Image dimensions are missing');
    }
    return {
      width: info.width,
      height: info.height,
      rgb: expandToRgb(data, info.width, info.height, info.channels),
    };
  } catch (error) {
    if (error instanceof InvalidImageError) throw error;
    throw new InvalidImageError('Image file is corrupted or unreadable', { cause: error });
  }
}

export async function createPreviewDataUrl(image: Buffer): Promise<string> {
  const jpeg = await sharp(image).resize(160, 160, { fit: 'fill' }).jpeg({ quality: 70 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

function expandToRgb(data: Buffer, width: number, height: number, channels: number): Buffer {
  if (channels === 3) return data;
  const rgb = Buffer.alloc(width * height * 3);
  if (channels === 1) {
    for (let index = 0; index < width * height; index += 1) {
      const value = data[index] ?? 0;
      rgb[index * 3] = value;
      rgb[index * 3 + 1] = value;
      rgb[index * 3 + 2] = value;
    }
    return rgb;
  }
  if (channels === 4) {
    for (let index = 0; index < width * height; index += 1) {
      rgb[index * 3] = data[index * 4] ?? 0;
      rgb[index * 3 + 1] = data[index * 4 + 1] ?? 0;
      rgb[index * 3 + 2] = data[index * 4 + 2] ?? 0;
    }
    return rgb;
  }
  throw new InvalidImageError('Unsupported color channel count');
}
