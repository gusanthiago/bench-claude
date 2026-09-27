import { describe, expect, it } from 'vitest';
import { formatDuration, formatNumber, formatPercent, renderMarkdown } from '../scripts/render.mjs';
import { summarizeRun } from '../scripts/summarize.mjs';
import { opsResult, timeResult } from './results.mjs';

const environment = {
  node: 'v24.6.0',
  v8: '13.6.233.10-node.24',
  platform: 'darwin',
  arch: 'arm64',
  release: '25.5.0',
  cpu: 'Apple M3 Pro',
  cpus: 12,
  memoryBytes: 36 * 1024 ** 3,
  loadAverage: 2.5,
  benchNode: '0.15.0',
  git: { commit: 'a1b2c3d', branch: 'main', dirty: true },
};

const render = (...suites) =>
  renderMarkdown(
    summarizeRun({
      file: 'benchmarks/sum.bench.mjs',
      startedAt: '2026-09-27T16:45:02.123Z',
      durationMs: 4200,
      environment,
      suites: suites.map((results) => ({ results })),
    }),
  );

describe('formatDuration', () => {
  it.each([
    [undefined, '—'],
    [Number.NaN, '—'],
    [0.5, '0.50 ns'],
    [999, '999.00 ns'],
    [1_500, '1.50 µs'],
    [2_500_000, '2.50 ms'],
    [3_200_000_000, '3.20 s'],
  ])('formats %s ns as %s', (ns, expected) => {
    expect(formatDuration(ns)).toBe(expected);
  });
});

describe('formatNumber', () => {
  it.each([
    [undefined, '—'],
    [12.345, '12.35'],
    [99.5, '99.5'],
    [400, '400'],
    [44_499_079.4, '44,499,079'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatNumber(value)).toBe(expected);
  });
});

describe('formatPercent', () => {
  it.each([
    [undefined, '—'],
    [0, '0.0%'],
    [47.1404, '47.1%'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatPercent(value)).toBe(expected);
  });
});

describe('renderMarkdown', () => {
  it.each([
    {
      title: 'the run environment',
      suites: [[opsResult('only', 100)]],
      expected: [
        '# Benchmark report: `benchmarks/sum.bench.mjs`',
        '- **Date:** 2026-09-27 16:45:02 UTC',
        '- **Node.js:** v24.6.0 (V8 13.6.233.10-node.24)',
        '- **bench-node:** 0.15.0',
        '- **Platform:** darwin arm64 (25.5.0)',
        '- **CPU:** Apple M3 Pro × 12',
        '- **Memory:** 36 GB',
        '- **Load average (1 min):** 2.50',
        '- **Git:** `a1b2c3d` on `main` (uncommitted changes)',
        '- **Duration:** 4.20 s',
      ],
    },
    {
      title: 'an ops suite ranked fastest first against its baseline',
      suites: [[opsResult('for loop', 100, { baseline: true }), opsResult('gauss formula', 400)]],
      expected: [
        '## Results',
        '| Benchmark | ops/sec | Mean | p75 | p99 | Min … Max | CV | Samples | vs baseline |\n' +
          '| :-- | --: | --: | --: | --: | --: | --: | --: | :-- |\n' +
          '| gauss formula | 400 | 2.50 ms | 2.50 ms | 2.50 ms | 2.50 ms … 2.50 ms | 0.0% | 3 | 4.00x faster |\n' +
          '| for loop | 100 | 10.00 ms | 10.00 ms | 10.00 ms | 10.00 ms … 10.00 ms | 0.0% | 3 | baseline |',
        'Plugins: v8-never-optimize=true',
      ],
    },
    {
      title: 'a time-mode suite',
      suites: [[timeResult('slow', 0.2, { baseline: true }), timeResult('quick', 0.05)]],
      expected: [
        '| Benchmark | Time | Min … Max | Samples | vs baseline |\n' +
          '| :-- | --: | --: | --: | :-- |\n' +
          '| quick | 50.00 ms | 50.00 ms … 50.00 ms | 1 | 4.00x faster |\n' +
          '| slow | 200.00 ms | 200.00 ms … 200.00 ms | 1 | baseline |',
      ],
    },
    {
      title: 'one section per suite',
      suites: [[opsResult('a', 10)], [opsResult('b', 20)]],
      expected: ['## Suite 1 of 2', '| a | 10 |', '## Suite 2 of 2', '| b | 20 |'],
    },
    {
      title: 't-test significance',
      suites: [
        [
          opsResult('base', 100, { baseline: true }),
          opsResult('fast', 300, { significance: { significant: true, pValue: 0.0001, stars: '***', alpha: 0.05 } }),
          opsResult('same', 101, { significance: { significant: false, pValue: 0.42, stars: '', alpha: 0.05 } }),
        ],
      ],
      expected: [
        '| vs baseline | Significance |',
        '| 3.00x faster | `***` (p<0.001) |',
        '| 1.01x faster | not significant (p=0.420) |',
        "Significance: Welch's t-test against the baseline over 30+ runs (α = 0.05).",
      ],
    },
    {
      title: 'plugin reports that differ per benchmark',
      suites: [[opsResult('a', 10), opsResult('b', 20, { plugins: [{ report: 'heap=1MB' }] })]],
      expected: ['Plugins:\n- b: heap=1MB\n- a: v8-never-optimize=true'],
    },
    {
      title: 'benchmark names containing pipes',
      suites: [[opsResult('a | b', 10)]],
      expected: ['| a \\| b | 10 |'],
    },
  ])('renders $title', ({ suites, expected }) => {
    const markdown = render(...suites);

    for (const text of expected) expect(markdown).toContain(text);
  });

  it('omits the significance column and plugin line when there is nothing to show', () => {
    const markdown = render([timeResult('a', 0.1), timeResult('b', 0.2)]);

    expect(markdown).not.toContain('Significance');
    expect(markdown).not.toContain('Plugins');
  });
});
