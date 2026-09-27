import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashCode } from '../scripts/regions.mjs';
import { writeFiles } from './files.mjs';

const MARKERS = fileURLToPath(new URL('../scripts/markers.mjs', import.meta.url));

const SUM_CODE = '  let total = 0;\n  for (const n of list) total += n;';
const SUM_HASH = hashCode(SUM_CODE);
const SUM = [
  'export const sum = (list) => {',
  '  // Start bench-claude: sum',
  SUM_CODE,
  '  // End bench-claude',
  '  return total;',
  '};',
  '',
].join('\n');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-claude-markers-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const markers = (...args) => spawnSync(process.execPath, [MARKERS, ...args], { cwd: tmpDir, encoding: 'utf8' });

describe('markers.mjs', () => {
  it.each([
    { title: 'without a benchmark file', files: {}, benchmark: 'benchmarks/sum.bench.mjs', fresh: false },
    {
      title: 'with a benchmark of the same code',
      files: { 'benchmarks/sum.bench.mjs': `// bench-claude region "sum" from src/sum.js hash=${SUM_HASH}\n` },
      benchmark: 'benchmarks/sum.bench.mjs',
      fresh: true,
    },
    {
      title: 'with a benchmark of older code',
      files: { 'benchmarks/sum.bench.mjs': '// bench-claude region "sum" from src/sum.js hash=000000000000\n' },
      benchmark: 'benchmarks/sum.bench.mjs',
      fresh: false,
    },
    {
      title: 'with a bench/ folder',
      files: { 'bench/.gitkeep': '' },
      benchmark: 'bench/sum.bench.mjs',
      fresh: false,
    },
  ])('finds the region $title', ({ files, benchmark, fresh }) => {
    writeFiles(tmpDir, { 'src/sum.js': SUM, ...files });

    const child = markers();

    expect(child.status, child.stderr).toBe(0);
    expect(JSON.parse(child.stdout)).toEqual({
      regions: [
        {
          name: 'sum',
          slug: 'sum',
          file: 'src/sum.js',
          start: 2,
          end: 5,
          hash: SUM_HASH,
          code: SUM_CODE,
          benchmark,
          header: `// bench-claude region "sum" from src/sum.js hash=${SUM_HASH}`,
          fresh,
        },
      ],
      errors: [],
    });
  });

  it.each([
    {
      title: 'a Start without an End',
      files: { 'src/a.js': '// Start bench-claude: a\nrun();\n' },
      status: 1,
      regions: 0,
      errors: [{ file: 'src/a.js', line: 1, message: 'Start marker without an End marker' }],
    },
    {
      title: 'the same name in two files',
      files: {
        'src/a.js': '// Start bench-claude: same\na();\n// End bench-claude\n',
        'src/b.js': '// Start bench-claude: same\nb();\n// End bench-claude\n',
      },
      status: 1,
      regions: 2,
      errors: [{ file: 'src/b.js', line: 1, message: 'duplicate name "same" (also used at src/a.js:1)' }],
    },
    {
      title: 'nothing for markers inside node_modules',
      files: { 'node_modules/lib/index.js': '// Start bench-claude: lib\nlib();\n// End bench-claude\n' },
      status: 0,
      regions: 0,
      errors: [],
    },
  ])('reports $title', ({ files, status, regions, errors }) => {
    writeFiles(tmpDir, files);

    const child = markers();
    const output = JSON.parse(child.stdout);

    expect(child.status).toBe(status);
    expect(output.regions).toHaveLength(regions);
    expect(output.errors).toEqual(errors);
  });

  it('only reads the given files', () => {
    writeFiles(tmpDir, { 'src/sum.js': SUM, 'src/other.js': SUM.replace('bench-claude: sum', 'bench-claude: other') });

    const child = markers('src/sum.js');

    expect(child.status, child.stderr).toBe(0);
    expect(JSON.parse(child.stdout).regions.map((region) => region.name)).toEqual(['sum']);
  });

  it('fails for a path that does not exist', () => {
    const child = markers('missing.js');

    expect(child.status).toBe(2);
    expect(child.stderr).toContain('not found: missing.js');
  });
});
