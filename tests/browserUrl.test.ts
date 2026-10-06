import { describe, expect, it } from 'vitest';

import { assertLocalBenchmarkUrl } from '../src/automation/browser';

describe('local benchmark URL guard', () => {
  it('allows localhost and rejects external origins', () => {
    expect(assertLocalBenchmarkUrl('http://localhost:3000/').hostname).toBe('localhost');
    expect(assertLocalBenchmarkUrl('http://127.0.0.1:3456/lab').hostname).toBe('127.0.0.1');
    expect(() => assertLocalBenchmarkUrl('https://example.com')).toThrow(/local application/);
    expect(() => assertLocalBenchmarkUrl('file:///tmp/index.html')).toThrow(/local application/);
    expect(() => assertLocalBenchmarkUrl('not a url')).toThrow(/invalid/);
  });
});
