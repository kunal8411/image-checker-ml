import { InvalidRequestError } from '../errors';
import type { EvaluationItem } from '../types/index';

export function parseGridDimension(value: unknown, field: 'rows' | 'columns', max: number): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new InvalidRequestError(`${field} must be a whole number`);
  }
  const parsed = Number(value);
  if (parsed < 1 || parsed > max) {
    throw new InvalidRequestError(`${field} must be between 1 and ${String(max)}`);
  }
  return parsed;
}

export function readFormField(body: unknown, name: string): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined;
  return (body as Record<string, unknown>)[name];
}

export function parseEvaluationItems(body: unknown): EvaluationItem[] {
  if (typeof body !== 'object' || body === null || !('items' in body)) {
    throw new InvalidRequestError('Expected an items array');
  }
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 256) {
    throw new InvalidRequestError('items must contain between 1 and 256 labels');
  }

  return items.map((item) => {
    if (typeof item !== 'object' || item === null) {
      throw new InvalidRequestError('Invalid evaluation item');
    }
    const actual = (item as { actual?: unknown }).actual;
    const predicted = (item as { predicted?: unknown }).predicted;
    if (typeof actual !== 'string' || typeof predicted !== 'string') {
      throw new InvalidRequestError('Labels must be strings');
    }
    if (!isSafeLabel(actual) || !isSafeLabel(predicted)) {
      throw new InvalidRequestError('Labels must be short lowercase tokens');
    }
    return { actual, predicted };
  });
}

function isSafeLabel(value: string): boolean {
  return value.length > 0 && value.length <= 64 && /^[a-z0-9-]+$/.test(value);
}
