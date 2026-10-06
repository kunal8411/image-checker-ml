import fs from 'node:fs/promises';
import path from 'node:path';

import type { Page } from 'puppeteer';

export async function saveScreenshot(page: Page, filePath: string): Promise<string> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await page.screenshot({ path: filePath, fullPage: true, type: 'png' });
  return filePath;
}
