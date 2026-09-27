import { describe, expect, it } from 'vitest';
import { findDuplicates, findRegions, hashCode, slugify } from '../scripts/regions.mjs';

const lines = (...rows) => rows.join('\n');

describe('findRegions', () => {
  it.each([
    {
      title: 'a named region',
      source: lines('const a = 1;', '// Start bench-claude: parse-headers', 'const b = a + 1;', '// End bench-claude', 'b;'),
      regions: [{ name: 'parse-headers', slug: 'parse-headers', start: 2, end: 4, code: 'const b = a + 1;' }],
    },
    {
      title: 'a region without a name',
      source: lines('  // Start bench-claude', '  run();', '  // End bench-claude'),
      regions: [{ name: 'src/http.js:1', slug: 'src-http-js-1', start: 1, end: 3, code: '  run();' }],
    },
    {
      title: 'markers with other case, spaces and a dash',
      source: lines('//   start BENCH-CLAUDE - Split Lines  ', 'split();', '//end bench-claude: split lines'),
      regions: [{ name: 'Split Lines', slug: 'split-lines', start: 1, end: 3, code: 'split();' }],
    },
    {
      title: 'Windows line endings',
      source: '// Start bench-claude: crlf\r\nrun();\r\n// End bench-claude\r\n',
      regions: [{ name: 'crlf', slug: 'crlf', start: 1, end: 3, code: 'run();' }],
    },
    {
      title: 'two regions',
      source: lines(
        '// Start bench-claude: one',
        'a();',
        '// End bench-claude',
        '// Start bench-claude: two',
        'b();',
        '// End bench-claude',
      ),
      regions: [
        { name: 'one', start: 1, end: 3, code: 'a();' },
        { name: 'two', start: 4, end: 6, code: 'b();' },
      ],
    },
  ])('finds $title', ({ source, regions }) => {
    const result = findRegions(source, 'src/http.js');

    expect(result.errors).toEqual([]);
    expect(result.regions).toMatchObject(regions);
  });

  it.each([
    {
      title: 'an End without a Start',
      source: lines('a();', '// End bench-claude'),
      errors: [{ line: 2, message: 'End marker without a Start marker' }],
    },
    {
      title: 'a Start without an End',
      source: lines('// Start bench-claude', 'a();'),
      errors: [{ line: 1, message: 'Start marker without an End marker' }],
    },
    {
      title: 'a Start inside a region',
      source: lines('// Start bench-claude: outer', '// Start bench-claude: inner', '// End bench-claude'),
      errors: [{ line: 2, message: 'Start marker inside the region opened at line 1' }],
    },
  ])('reports $title', ({ source, errors }) => {
    expect(findRegions(source, 'src/http.js').errors).toEqual(
      errors.map((error) => ({ file: 'src/http.js', ...error })),
    );
  });
});

describe('slugify', () => {
  it.each([
    ['parse-headers', 'parse-headers'],
    ['Split Lines', 'split-lines'],
    ['src/http.js:2', 'src-http-js-2'],
    ['  --Weird__Name!! ', 'weird-name'],
  ])('%s → %s', (text, expected) => {
    expect(slugify(text)).toBe(expected);
  });
});

describe('hashCode', () => {
  it.each([
    { a: 'run();', b: 'run();', same: true },
    { a: 'run();', b: 'run(); ', same: false },
    { a: 'run();', b: '  run();', same: false },
  ])('"$a" and "$b" have the same hash: $same', ({ a, b, same }) => {
    expect(hashCode(a)).toMatch(/^[0-9a-f]{12}$/);
    expect(hashCode(a) === hashCode(b)).toBe(same);
  });
});

describe('findDuplicates', () => {
  it.each([
    {
      title: 'accepts unique names',
      regions: [
        { name: 'a', slug: 'a', file: 'x.js', start: 1 },
        { name: 'b', slug: 'b', file: 'y.js', start: 1 },
      ],
      errors: [],
    },
    {
      title: 'reports a name used twice',
      regions: [
        { name: 'a', slug: 'a', file: 'x.js', start: 1 },
        { name: 'A', slug: 'a', file: 'y.js', start: 5 },
      ],
      errors: [{ file: 'y.js', line: 5, message: 'duplicate name "A" (also used at x.js:1)' }],
    },
  ])('$title', ({ regions, errors }) => {
    expect(findDuplicates(regions)).toEqual(errors);
  });
});
