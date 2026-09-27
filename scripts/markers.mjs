#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { findDuplicates, findRegions } from './regions.mjs';
import { displayPath, fail, listSourceFiles } from './utils.mjs';

const USAGE = 'usage: markers.mjs [file-or-folder...]';
const BENCH_DIRS = ['benchmarks', 'benchmark', 'bench'];

const isDirectory = (dir) => fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory() ?? false;

const firstLine = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n', 1)[0] : '');

const withBenchmark = (region, benchDir) => {
  const benchmark = path.join(benchDir, `${region.slug}.bench.mjs`);
  return {
    ...region,
    benchmark,
    header: `// bench-claude region "${region.name}" from ${region.file} hash=${region.hash}`,
    fresh: firstLine(benchmark).includes(`hash=${region.hash}`),
  };
};

const main = (argv) => {
  let targets;
  try {
    ({ positionals: targets } = parseArgs({ args: argv, allowPositionals: true }));
  } catch (error) {
    return fail(`${error.message}\n${USAGE}`, 2);
  }
  const missing = targets.find((target) => !fs.existsSync(target));
  if (missing) return fail(`not found: ${missing}`, 2);

  const benchDir = BENCH_DIRS.find(isDirectory) ?? 'benchmarks';
  const files = [...new Set((targets.length ? targets : ['.']).flatMap(listSourceFiles).map((file) => path.resolve(file)))];
  const found = files.map((file) => findRegions(fs.readFileSync(file, 'utf8'), displayPath(file)));
  const regions = found.flatMap((result) => result.regions).map((region) => withBenchmark(region, benchDir));
  const errors = [...found.flatMap((result) => result.errors), ...findDuplicates(regions)];

  console.log(JSON.stringify({ regions, errors }, null, 2));
  return errors.length ? 1 : 0;
};

process.exitCode = main(process.argv.slice(2));
