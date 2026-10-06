import fs from 'node:fs/promises';
import path from 'node:path';

import { createSampleGridImage } from '../src/image/sampleImage';

const destination = path.join(process.cwd(), 'fixtures', 'sample-grid.png');
await fs.mkdir(path.dirname(destination), { recursive: true });
await fs.writeFile(destination, await createSampleGridImage());
console.log(JSON.stringify({ event: 'sample_image_written', path: destination }));
