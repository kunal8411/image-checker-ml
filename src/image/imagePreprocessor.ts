import sharp from 'sharp';

import { PreprocessingError } from '../errors';
import type { PreprocessingConfig } from '../types/index';

export interface ImagePreprocessor {
  preprocess(image: Buffer): Promise<Buffer>;
}

export class SharpImagePreprocessor implements ImagePreprocessor {
  constructor(private readonly config: PreprocessingConfig) {
    if (!Number.isInteger(config.width) || config.width < 1 || config.width > 1024) {
      throw new PreprocessingError('Preprocess width is invalid');
    }
    if (!Number.isInteger(config.height) || config.height < 1 || config.height > 1024) {
      throw new PreprocessingError('Preprocess height is invalid');
    }
    if (!Number.isFinite(config.contrast) || config.contrast < 0.5 || config.contrast > 2) {
      throw new PreprocessingError(
        'Contrast must stay between 0.5 and 2. Extreme contrast destroys tonal information the classifier can use.',
      );
    }
  }

  async preprocess(image: Buffer): Promise<Buffer> {
    if (image.length === 0) throw new PreprocessingError('Cannot preprocess an empty image');

    // Resize is the only step the network requires. Histogram stretching,
    // sharpening, and contrast changes are opt-in because a pretrained model
    // expects natural image statistics. Strong sharpening creates halos and
    // amplifies noise. Denoising is intentionally absent: it removes texture
    // and cannot recover detail that blur or low resolution never captured.
    try {
      let pipeline = sharp(image, { failOn: 'error' })
        .rotate()
        .resize(this.config.width, this.config.height, { fit: 'fill' });

      if (this.config.normalize) pipeline = pipeline.normalize();
      if (this.config.contrast !== 1) {
        const slope = this.config.contrast;
        pipeline = pipeline.linear(slope, 128 * (1 - slope));
      }
      if (this.config.sharpen) {
        pipeline = pipeline.sharpen({ sigma: 0.6, m1: 0.4, m2: 0.3 });
      }
      return await pipeline.png().toBuffer();
    } catch (error) {
      if (error instanceof PreprocessingError) throw error;
      throw new PreprocessingError('Image preprocessing failed', { cause: error });
    }
  }
}
