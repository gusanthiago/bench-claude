import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const { serializeSuite } = createRequire(import.meta.url)('../scripts/capture.cjs');

const plugin = { name: 'V8NeverOptimizePlugin', result: 'enabled', report: 'v8-never-optimize=true' };

const statisticalHistogram = (all) => ({
  all,
  min: Math.min(...all),
  max: Math.max(...all),
  get samples() {
    return this.all.slice();
  },
});

describe('serializeSuite', () => {
  it.each([
    {
      versions: '0.5.4 and newer',
      histogram: { samples: 3, min: 1, max: 3, sampleData: [1, 2, 3] },
      plugins: [plugin],
      expected: { histogram: { samples: 3, min: 1, max: 3, sampleData: [1, 2, 3] }, plugins: [plugin] },
    },
    {
      versions: '0.5.0 to 0.5.3',
      histogram: { samples: 3, min: 1, max: 3 },
      plugins: [plugin],
      expected: { histogram: { samples: 3, min: 1, max: 3 }, plugins: [plugin] },
    },
    {
      versions: '0.2 to 0.4',
      histogram: statisticalHistogram([1, 2, 3]),
      plugins: [plugin],
      expected: { histogram: { samples: 3, min: 1, max: 3, sampleData: [1, 2, 3] }, plugins: [plugin] },
    },
    {
      versions: '0.1',
      histogram: statisticalHistogram([1, 2, 3]),
      plugins: { V8NeverOptimizePlugin: 'enabled' },
      expected: { histogram: { samples: 3, min: 1, max: 3, sampleData: [1, 2, 3] }, plugins: [] },
    },
  ])('reads the result shape of bench-node $versions', ({ histogram, plugins, expected }) => {
    const [record] = serializeSuite([{ name: 'a', opsSec: 10, histogram, plugins }]);

    expect(record.histogram).toEqual(expected.histogram);
    expect(record.plugins).toEqual(expected.plugins);
  });
});
