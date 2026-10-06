import { describe, expect, it } from 'vitest';

import { ModelManager } from '../src/ml/modelLoader';

describe('ModelManager', () => {
  it('loads once for concurrent callers and keeps the model', async () => {
    let calls = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const manager = new ModelManager(async () => {
      calls += 1;
      await gate;
      return { name: 'mobilenet' };
    });

    const first = manager.initialize();
    const second = manager.initialize();
    release();
    await Promise.all([first, second]);

    expect(calls).toBe(1);
    expect(manager.getModel()).toEqual({ name: 'mobilenet' });
    await manager.initialize();
    expect(calls).toBe(1);
  });

  it('allows a retry after initialization fails', async () => {
    let calls = 0;
    const manager = new ModelManager(async () => {
      calls += 1;
      if (calls === 1) throw new Error('weights unavailable');
      return 'ready';
    });

    await expect(manager.initialize()).rejects.toThrow(/weights unavailable/);
    expect(() => manager.getModel()).toThrow(/not loaded/);
    await manager.initialize();
    expect(manager.getModel()).toBe('ready');
  });
});
