import fs from 'node:fs/promises';
import path from 'node:path';

import type { ElementHandle } from 'puppeteer';

import type { BenchmarkResult, Prediction } from '../types/index';
import { launchBrowser, openPage } from './browser';
import { saveScreenshot } from './screenshot';

export interface BenchmarkRunOptions {
  baseUrl: string;
  imagePath: string;
  rows: 3 | 4;
  columns: 3 | 4;
  targetClass: string;
  reportPath: string;
  screenshotPath: string;
  headless?: boolean;
}

export class BenchmarkRunner {
  constructor(private readonly options: BenchmarkRunOptions) {}

  async run(): Promise<BenchmarkResult> {
    if (this.options.rows !== this.options.columns) {
      throw new Error('Benchmark grid must be square');
    }
    const browser = await launchBrowser({ headless: this.options.headless ?? true });
    try {
      const page = await openPage(browser, this.options.baseUrl);
      await page.waitForSelector('[data-testid="file-input"]');
      const input = await page.$('[data-testid="file-input"]');
      if (!input) throw new Error('File input is missing');
      await (input as ElementHandle<HTMLInputElement>).uploadFile(this.options.imagePath);
      await page.click(`[data-testid="grid-${String(this.options.rows)}"]`);
      await page.select('[data-testid="target-class"]', this.options.targetClass);
      await page.waitForFunction(() => {
        const button = document.querySelector('[data-testid="analyze-button"]');
        return button instanceof HTMLButtonElement && !button.disabled;
      });

      const started = Date.now();
      await page.click('[data-testid="analyze-button"]');
      await page.waitForFunction(
        (expected) => {
          const cards = document.querySelectorAll('[data-testid="region-card"]').length;
          return cards >= expected || Boolean(document.querySelector('[data-testid="error"]'));
        },
        { timeout: 180_000 },
        this.options.rows * this.options.columns,
      );
      const clientWallClockMs = Date.now() - started;

      const errorText = await page
        .$eval('[data-testid="error"]', (element) => element.textContent)
        .catch(() => null);
      if (errorText) throw new Error(errorText);

      const rawPredictions = await page.$$eval('[data-testid="region-card"]', (cards) =>
        cards.map((card) => card.getAttribute('data-prediction')),
      );
      const predictions = rawPredictions.map((raw) => parsePrediction(raw));
      const timing = await page.$eval('[data-testid="latency-panel"]', (panel) => ({
        preprocessingMs: panel.getAttribute('data-preprocessing-ms'),
        inferenceMs: panel.getAttribute('data-inference-ms'),
        totalMs: panel.getAttribute('data-total-ms'),
        averageMs: panel.getAttribute('data-average-ms'),
      }));

      await saveScreenshot(page, this.options.screenshotPath);
      const result: BenchmarkResult = {
        totalRegions: predictions.length,
        totalInferenceTimeMs: numberAttribute(timing.inferenceMs),
        averageLatencyMs: numberAttribute(timing.averageMs),
        predictions,
        preprocessingMs: numberAttribute(timing.preprocessingMs),
        inferenceMs: numberAttribute(timing.inferenceMs),
        totalMs: numberAttribute(timing.totalMs),
        clientWallClockMs,
        screenshotPath: this.options.screenshotPath,
        reportPath: this.options.reportPath,
      };
      await fs.mkdir(path.dirname(this.options.reportPath), { recursive: true });
      await fs.writeFile(this.options.reportPath, JSON.stringify(result, null, 2));
      return result;
    } finally {
      await browser.close();
    }
  }
}

function parsePrediction(raw: string | null): Prediction {
  if (!raw) throw new Error('Prediction card is missing its result');
  const parsed: unknown = JSON.parse(raw);
  if (!isPrediction(parsed)) throw new Error('Prediction card has an invalid result');
  return parsed;
}

function isPrediction(value: unknown): value is Prediction {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.predictedClass === 'string' &&
    typeof record.confidence === 'number' &&
    typeof record.probabilities === 'object' &&
    record.probabilities !== null
  );
}

function numberAttribute(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error('Latency panel is missing a timing value');
  return parsed;
}
