import sharp from 'sharp';

export async function solidPng(
  width: number,
  height: number,
  color: { r: number; g: number; b: number } = { r: 20, g: 80, b: 140 },
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .png()
    .toBuffer();
}

export async function gradientPng(width: number, height: number): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 3;
      raw[index] = x % 256;
      raw[index + 1] = y % 256;
      raw[index + 2] = (x * 3 + y * 5) % 256;
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

export function noisePng(width: number, height: number, seed = 7): Promise<Buffer> {
  const random = mulberry32(seed);
  const raw = Buffer.alloc(width * height * 3);
  for (let index = 0; index < raw.length; index += 1) {
    raw[index] = Math.floor(random() * 256);
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
