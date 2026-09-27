'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { isMainThread } = require('node:worker_threads');

const MIN_RUNS_FOR_TTEST = 30;
const ALPHA = 0.05;

const outputFile = process.env.BENCH_CLAUDE_OUTPUT;

const readVersion = (requireFromEntry) => {
  try {
    return requireFromEntry('bench-node/package.json').version;
  } catch {
    return null;
  }
};

const readHistogram = (histogram = {}) => {
  const sampleData = [histogram.sampleData, histogram.samples].find(Array.isArray);
  return {
    samples: sampleData?.length ?? histogram.samples,
    min: histogram.min,
    max: histogram.max,
    sampleData,
  };
};

const readPlugins = (plugins) =>
  Array.isArray(plugins) ? plugins.map(({ name, result, report }) => ({ name, result, report })) : [];

const serializeSuite = (results, compareBenchmarks) => {
  const baseline = results.find((result) => result.baseline);
  return results.map((result) => {
    const record = {
      name: result.name,
      baseline: result.baseline === true,
      iterations: result.iterations,
      opsSec: result.opsSec,
      opsSecPerRun: result.opsSecPerRun,
      totalTime: result.totalTime,
      histogram: readHistogram(result.histogram),
      plugins: readPlugins(result.plugins),
    };
    if (
      typeof compareBenchmarks === 'function' &&
      baseline &&
      result !== baseline &&
      result.opsSecPerRun?.length >= MIN_RUNS_FOR_TTEST &&
      baseline.opsSecPerRun?.length >= MIN_RUNS_FOR_TTEST
    ) {
      const { significant, pValue, confidence, stars } = compareBenchmarks(
        result.opsSecPerRun,
        baseline.opsSecPerRun,
        ALPHA,
      );
      record.significance = { significant, pValue, confidence, stars, alpha: ALPHA };
    }
    return record;
  });
};

const install = (file, requireFromEntry) => {
  let benchNode;
  try {
    benchNode = requireFromEntry('bench-node');
  } catch {
    return;
  }

  const capture = { benchNodeVersion: readVersion(requireFromEntry), suites: [] };
  const run = benchNode.Suite.prototype.run;

  benchNode.Suite.prototype.run = async function (...args) {
    const results = await run.apply(this, args);
    try {
      capture.suites.push({ results: serializeSuite(results, benchNode.compareBenchmarks) });
      fs.writeFileSync(file, JSON.stringify(capture));
    } catch (error) {
      capture.error ??= String(error);
      fs.writeFileSync(file, JSON.stringify({ benchNodeVersion: capture.benchNodeVersion, error: capture.error }));
    }
    return results;
  };
};

if (isMainThread && outputFile && process.argv[1]) {
  install(outputFile, createRequire(path.resolve(process.argv[1])));
}

module.exports = { serializeSuite };
