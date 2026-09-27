import { describe, expect, it } from 'vitest';
import {
  coefficientOfVariation,
  mean,
  percentile,
  summarizeResult,
  summarizeSuite,
} from '../scripts/summarize.mjs';
import { opsResult, timeResult } from './results.mjs';

const round = (value) => (value === undefined ? value : Math.round(value * 100) / 100);

describe('percentile', () => {
  it.each([
    { sorted: [], p: 50, expected: undefined },
    { sorted: [7], p: 99, expected: 7 },
    { sorted: [1, 2, 3, 4], p: 0, expected: 1 },
    { sorted: [1, 2, 3, 4], p: 50, expected: 2 },
    { sorted: [1, 2, 3, 4], p: 75, expected: 3 },
    { sorted: [1, 2, 3, 4], p: 100, expected: 4 },
  ])('p$p of $sorted is $expected', ({ sorted, p, expected }) => {
    expect(percentile(sorted, p)).toBe(expected);
  });
});

describe('mean and coefficientOfVariation', () => {
  it.each([
    { values: [], expectedMean: undefined, expectedCv: undefined },
    { values: [5], expectedMean: 5, expectedCv: undefined },
    { values: [0, 0], expectedMean: 0, expectedCv: undefined },
    { values: [10, 10, 10], expectedMean: 10, expectedCv: 0 },
    { values: [2, 4], expectedMean: 3, expectedCv: 47.14 },
  ])('$values → mean $expectedMean, CV $expectedCv', ({ values, expectedMean, expectedCv }) => {
    expect(mean(values)).toBe(expectedMean);
    expect(round(coefficientOfVariation(values))).toBe(expectedCv);
  });
});

describe('summarizeResult', () => {
  it('sorts samples before computing stats and keeps non-empty plugin reports', () => {
    const row = summarizeResult({
      name: 'x',
      opsSec: 1,
      histogram: { samples: 4, min: 1, max: 4, sampleData: [4, 1, 3, 2] },
      plugins: [{ report: 'v8-never-optimize=true' }, { report: '' }],
    });

    expect(row).toMatchObject({ mean: 2.5, p75: 3, p99: 4, pluginReports: ['v8-never-optimize=true'] });
  });
});

describe('summarizeSuite', () => {
  it.each([
    {
      title: 'ranks ops results fastest first against the baseline',
      results: [opsResult('base', 100, { baseline: true }), opsResult('fast', 250), opsResult('slow', 50)],
      mode: 'ops',
      reference: { name: 'base', kind: 'baseline' },
      rows: [
        ['fast', '2.50x faster'],
        ['base', 'baseline'],
        ['slow', '2.00x slower'],
      ],
    },
    {
      title: 'falls back to the fastest result without a baseline',
      results: [opsResult('a', 100), opsResult('b', 400)],
      mode: 'ops',
      reference: { name: 'b', kind: 'fastest' },
      rows: [
        ['b', 'fastest'],
        ['a', '4.00x slower'],
      ],
    },
    {
      title: 'treats a lower totalTime as faster in time mode',
      results: [timeResult('slow', 0.2, { baseline: true }), timeResult('quick', 0.05)],
      mode: 'time',
      reference: { name: 'slow', kind: 'baseline' },
      rows: [
        ['quick', '4.00x faster'],
        ['slow', 'baseline'],
      ],
    },
    {
      title: 'leaves a result without a metric uncompared',
      results: [opsResult('ok', 10), { name: 'broken', plugins: [] }],
      mode: 'ops',
      reference: { name: 'ok', kind: 'fastest' },
      rows: [
        ['ok', 'fastest'],
        ['broken', undefined],
      ],
    },
  ])('$title', ({ results, mode, reference, rows }) => {
    const suite = summarizeSuite(results);

    expect(suite.mode).toBe(mode);
    expect(suite.reference).toEqual(reference);
    expect(suite.rows.map((row) => [row.name, row.comparison])).toEqual(rows);
  });
});
