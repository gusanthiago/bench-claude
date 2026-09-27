import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFiles } from './files.mjs';

const BENCH = fileURLToPath(new URL('../scripts/bench.mjs', import.meta.url));
const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

let tmpDir;
let outDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-claude-test-'));
  outDir = path.join(tmpDir, 'out');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const bench = (...args) =>
  spawnSync(process.execPath, [BENCH, ...args, '--out-dir', outDir], { encoding: 'utf8' });

describe.each([
  { format: 'CommonJS', file: 'sum.bench.cjs', reporter: 'reporter disabled' },
  { format: 'ES module', file: 'sum.bench.mjs', reporter: 'the default text reporter' },
])('running a $format benchmark with $reporter', ({ file }) => {
  it('captures every result and writes the JSON and Markdown reports', () => {
    const child = bench(fixture(file));

    expect(child.status, child.stderr).toBe(0);
    const [jsonFile, reportFile] = fs.readdirSync(outDir).sort();
    expect(jsonFile).toMatch(/^sum\.bench-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
    expect(reportFile).toBe(jsonFile.replace(/\.json$/, '.md'));

    const run = JSON.parse(fs.readFileSync(path.join(outDir, jsonFile), 'utf8'));
    expect(run.environment.benchNode).toMatch(/^\d+\.\d+\.\d+/);
    expect(run.suites).toHaveLength(1);
    expect(run.suites[0].results.map(({ name, baseline }) => [name, baseline])).toEqual([
      ['for loop', true],
      ['gauss formula', false],
    ]);
    for (const result of run.suites[0].results) expect(result.opsSec).toBeGreaterThan(0);

    const report = fs.readFileSync(path.join(outDir, reportFile), 'utf8');
    expect(report).toContain('| for loop |');
    expect(report).toContain('| baseline |');
    expect(child.stdout).toContain(`bench-claude: report  ${path.join(outDir, reportFile)}`);
  });
});

describe('bench.mjs failures', () => {
  it.each([
    { title: 'no benchmark file', args: () => [], status: 2, message: 'usage: bench.mjs' },
    { title: 'a missing file', args: () => ['missing.bench.mjs'], status: 2, message: 'benchmark file not found' },
    {
      title: 'a project without bench-node',
      args: () => {
        writeFiles(tmpDir, { 'orphan.bench.cjs': "require('bench-node');\n" });
        return [path.join(tmpDir, 'orphan.bench.cjs')];
      },
      status: 2,
      message: 'bench-node is not installed',
    },
    {
      title: 'results that capture.cjs cannot read',
      args: () => {
        writeFiles(tmpDir, {
          'project/node_modules/bench-node/package.json': '{ "name": "bench-node", "version": "9.9.9" }\n',
          'project/node_modules/bench-node/index.js': 'module.exports = { Suite: class { async run() {} } };\n',
          'project/odd.bench.cjs':
            "const { Suite } = require('bench-node');\nnew Suite().run().then(() => console.log('benchmark finished'));\n",
        });
        return [path.join(tmpDir, 'project/odd.bench.cjs')];
      },
      status: 1,
      message: 'could not read the results from bench-node 9.9.9',
      stdout: 'benchmark finished',
    },
    {
      title: 'a file that never runs a suite',
      args: () => [fixture('no-suite.cjs')],
      status: 1,
      message: 'no bench-node results captured',
    },
    {
      title: 'a benchmark that throws',
      args: () => [fixture('throws.cjs')],
      status: 1,
      message: 'benchmark exited with code 1',
    },
  ])('rejects $title without writing reports', ({ args, status, message, stdout = '' }) => {
    const child = bench(...args());

    expect(child.status).toBe(status);
    expect(child.stderr).toContain(message);
    expect(child.stdout).toContain(stdout);
    expect(fs.existsSync(outDir)).toBe(false);
  });
});
