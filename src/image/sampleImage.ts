import sharp from 'sharp';

export async function createSampleGridImage(width = 640, height = 480): Promise<Buffer> {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#8eb4c4"/>
      <rect y="${height * 0.62}" width="100%" height="${height * 0.38}" fill="#6d7370"/>
      <rect x="40" y="150" width="120" height="160" fill="#c46b4a"/>
      <rect x="180" y="110" width="150" height="200" fill="#d8d2c4"/>
      <rect x="360" y="170" width="110" height="140" fill="#8c5a3c"/>
      <circle cx="520" cy="210" r="58" fill="#2f6b45"/>
      <rect x="508" y="210" width="24" height="100" fill="#5a3b28"/>
      <rect x="70" y="${height * 0.68}" width="150" height="48" rx="10" fill="#d6453d"/>
      <circle cx="108" cy="${height * 0.68 + 48}" r="14" fill="#1d2430"/>
      <circle cx="186" cy="${height * 0.68 + 48}" r="14" fill="#1d2430"/>
      <rect x="250" y="${height * 0.66}" width="46" height="70" fill="#2457c5"/>
      <circle cx="262" cy="${height * 0.66 + 70}" r="12" fill="#1d2430"/>
      <circle cx="286" cy="${height * 0.66 + 70}" r="12" fill="#1d2430"/>
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
