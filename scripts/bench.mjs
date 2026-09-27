#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { renderMarkdown } from './render.mjs';
import { summarizeRun } from './summarize.mjs';
import { fail, displayPath, resolvesBenchNode, collectEnvironment, readCapture } from './utils.mjs'

const CAPTURE = fileURLToPath(new URL('./capture.cjs', import.meta.url));
const USAGE = 'usage: bench.mjs <benchmark-file> [--out-dir <dir>]';

const runBenchmark = (file, outDir, captureFile) => {
  const startedAt = new Date();
  const loadAverage = os.loadavg()[0];
  const child = spawnSync(
    process.execPath,
    ['--allow-natives-syntax', '--expose-gc', '--require', CAPTURE, file],
    { stdio: 'inherit', env: { ...process.env, BENCH_CLAUDE_OUTPUT: captureFile } },
  );
  if (child.error) throw child.error;
  if (child.status !== 0) {
    return fail(`benchmark exited with ${child.signal ?? `code ${child.status}`}`, child.status || 1);
  }
  const capture = readCapture(captureFile);
  if (!capture) return fail('no bench-node results captured. Does the file call suite.run()?', 1);
  if (capture.error) {
    return fail(
      `could not read the results from bench-node ${capture.benchNodeVersion ?? '(unknown version)'}: ${capture.error}`,
      1,
    );
  }

  const run = {
    file: displayPath(file),
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    environment: collectEnvironment(path.dirname(file), capture.benchNodeVersion, loadAverage),
    suites: capture.suites,
  };

  const stem = `${path.basename(file).replace(/\.[cm]?[jt]s$/, '')}-${run.startedAt.slice(0, 19).replaceAll(':', '-')}`;
  const jsonPath = path.join(outDir, `${stem}.json`);
  const reportPath = path.join(outDir, `${stem}.md`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(run, null, 2)}\n`);
  fs.writeFileSync(reportPath, renderMarkdown(summarizeRun(run)));

  console.log(`\nbench-claude: report  ${displayPath(reportPath)}`);
  console.log(`bench-claude: results ${displayPath(jsonPath)}`);
  return 0;
};

const main = (argv) => {
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: { 'out-dir': { type: 'string', default: 'bench-results' } },
    });
  } catch (error) {
    return fail(`${error.message}\n${USAGE}`, 2);
  }
  if (args.positionals.length !== 1) return fail(USAGE, 2);

  const [input] = args.positionals;
  const file = path.resolve(input);
  if (!fs.existsSync(file)) return fail(`benchmark file not found: ${input}`, 2);
  if (!resolvesBenchNode(file)) {
    return fail(
      `bench-node is not installed where ${input} can import it. Add it as a dev dependency (e.g. npm install --save-dev bench-node).`,
      2,
    );
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-claude-'));
  try {
    return runBenchmark(file, path.resolve(args.values['out-dir']), path.join(tmpDir, 'capture.json'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};

process.exitCode = main(process.argv.slice(2));
