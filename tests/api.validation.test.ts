import sharp from 'sharp';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { assertSafeFilename } from '../src/image/imageLoader';
import { createApp } from '../src/server/createApp';
import { FakeClassifier, testConfig } from './helpers/app';
import { solidPng } from './helpers/images';

async function buildApp(overrides: Parameters<typeof testConfig>[0] = {}) {
  return createApp({
    config: testConfig(overrides),
    classifier: new FakeClassifier(),
    clientMode: 'none',
  });
}

describe('POST /api/analyze validation', () => {
  it('returns predictions for a valid 3x3 image and supports 1x1 and 4x4', async () => {
    const handle = await buildApp();
    const png = await solidPng(64, 48);
    const response = await request(handle.app)
      .post('/api/analyze')
      .field('rows', '3')
      .field('columns', '3')
      .attach('image', png, { filename: 'grid.png', contentType: 'image/png' });

    expect(response.status).toBe(200);
    expect(response.body.regions).toHaveLength(9);
    expect(response.body.predictions).toHaveLength(9);
    expect(response.body.predictions[0].predictedClass).toBe('car');
    expect(response.body.predictions[0].confidence).toBeGreaterThan(0.9);
    expect(response.body.latency.regionCount).toBe(9);
    expect(response.body.metrics).toBeNull();

    const single = await request(handle.app)
      .post('/api/analyze')
      .field('rows', '1')
      .field('columns', '1')
      .attach('image', png, { filename: 'grid.png', contentType: 'image/png' });
    expect(single.status).toBe(200);
    expect(single.body.regions).toHaveLength(1);

    const sixteen = await request(handle.app)
      .post('/api/analyze')
      .field('rows', '4')
      .field('columns', '4')
      .attach('image', png, { filename: 'grid.png', contentType: 'image/png' });
    expect(sixteen.status).toBe(200);
    expect(sixteen.body.regions).toHaveLength(16);
    await handle.close();
  });

  it('rejects empty, corrupt, unsupported, oversized, and invalid grid input', async () => {
    const handle = await buildApp();
    const tiny = await solidPng(8, 8);

    const empty = await request(handle.app)
      .post('/api/analyze')
      .field('rows', '1')
      .field('columns', '1')
      .attach('image', Buffer.alloc(0), { filename: 'empty.png', contentType: 'image/png' });
    expect(empty.status).toBe(400);

    const corrupt = await request(handle.app)
      .post('/api/analyze')
      .field('rows', '1')
      .field('columns', '1')
      .attach('image', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]), {
        filename: 'broken.png',
        contentType: 'image/png',
      });
    expect(corrupt.status).toBe(400);
    expect(corrupt.body.code).toBe('invalid_image');

    const text = await request(handle.app)
      .post('/api/analyze')
      .field('rows', '1')
      .field('columns', '1')
      .attach('image', Buffer.from('hello'), { filename: 'notes.png', contentType: 'image/png' });
    expect(text.status).toBe(400);

    expect(() => assertSafeFilename('../secret.png')).toThrow(/Invalid file name/);
    expect(() => assertSafeFilename('folder/secret.png')).toThrow(/Invalid file name/);
    expect(() => assertSafeFilename('..\\secret.png')).toThrow(/Invalid file name/);
    const traversal = await request(handle.app)
      .post('/api/analyze')
      .field('rows', '1')
      .field('columns', '1')
      .attach('image', tiny, { filename: 'safe..name.png', contentType: 'image/png' });
    expect(traversal.status).toBe(400);

    const invalidGrid = await request(handle.app)
      .post('/api/analyze')
      .field('rows', '9')
      .field('columns', '3')
      .attach('image', tiny, { filename: 'grid.png', contentType: 'image/png' });
    expect(invalidGrid.status).toBe(400);
    expect(invalidGrid.body.code).toBe('invalid_request');

    const missing = await request(handle.app).post('/api/analyze').field('rows', '3').field('columns', '3');
    expect(missing.status).toBe(400);

    const jpeg = await sharp({
      create: { width: 12, height: 12, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .jpeg()
      .toBuffer();
    const mismatch = await request(handle.app)
      .post('/api/analyze')
      .field('rows', '1')
      .field('columns', '1')
      .attach('image', jpeg, { filename: 'photo.png', contentType: 'image/png' });
    expect(mismatch.status).toBe(400);

    const dimensionHandle = await buildApp({ maxImageDimension: 32 });
    const huge = await solidPng(48, 48);
    const tooBigDimension = await request(dimensionHandle.app)
      .post('/api/analyze')
      .field('rows', '1')
      .field('columns', '1')
      .attach('image', huge, { filename: 'huge.png', contentType: 'image/png' });
    expect(tooBigDimension.status).toBe(413);
    await dimensionHandle.close();

    const byteHandle = await buildApp({ maxUploadBytes: 80 });
    const oversizedBytes = await request(byteHandle.app)
      .post('/api/analyze')
      .field('rows', '1')
      .field('columns', '1')
      .attach('image', Buffer.alloc(400, 1), { filename: 'big.png', contentType: 'image/png' });
    expect(oversizedBytes.status).toBe(413);
    await byteHandle.close();
    await handle.close();
  });

  it('evaluates human labels against model labels', async () => {
    const handle = await buildApp();
    const response = await request(handle.app)
      .post('/api/evaluate')
      .send({
        items: [
          { actual: 'car', predicted: 'car' },
          { actual: 'car', predicted: 'bus' },
          { actual: 'bus', predicted: 'bus' },
          { actual: 'bicycle', predicted: 'bicycle' },
        ],
      });
    expect(response.status).toBe(200);
    expect(response.body.accuracy).toBeCloseTo(0.75);
    expect(response.body.macroF1).toBeGreaterThan(0);
    expect(response.body.confusionMatrix.labels).toEqual(['bicycle', 'bus', 'car']);

    const empty = await request(handle.app).post('/api/evaluate').send({ items: [] });
    expect(empty.status).toBe(400);
    await handle.close();
  });
});
