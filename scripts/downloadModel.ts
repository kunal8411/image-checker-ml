import fs from 'node:fs/promises';
import path from 'node:path';

import { downloadMobileNet, summarizeLabelMap } from '../src/ml/downloadModel';

const modelDir = path.join(process.cwd(), 'models', 'mobilenet');
await downloadMobileNet(modelDir);
const parsed: unknown = JSON.parse(await fs.readFile(path.join(modelDir, 'labels.json'), 'utf8'));
if (!Array.isArray(parsed) || parsed.some((label) => typeof label !== 'string')) {
  throw new Error('Downloaded labels are invalid');
}
const labels = parsed as string[];
console.log(
  JSON.stringify(
    {
      event: 'model_download_complete',
      modelDir,
      labels: labels.length,
      mappedClasses: summarizeLabelMap(labels),
    },
    null,
    2,
  ),
);
