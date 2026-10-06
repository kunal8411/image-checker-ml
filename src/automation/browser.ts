import puppeteer, { type Browser, type Page } from 'puppeteer';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function assertLocalBenchmarkUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Benchmark URL is invalid');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Benchmark runner only opens this local application');
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error('Benchmark runner only opens this local application');
  }
  return url;
}

export async function launchBrowser(options?: { headless?: boolean }): Promise<Browser> {
  return puppeteer.launch({
    headless: options?.headless ?? true,
    args: ['--disable-dev-shm-usage'],
  });
}

export async function openPage(browser: Browser, url: string): Promise<Page> {
  assertLocalBenchmarkUrl(url);
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  return page;
}
