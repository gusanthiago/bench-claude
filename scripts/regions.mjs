import { createHash } from 'node:crypto';

const START = /^\s*\/\/\s*start bench-claude\b[\s:-]*(.*?)\s*$/i;
const END = /^\s*\/\/\s*end bench-claude\b/i;

export const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const hashCode = (code) => createHash('sha256').update(code).digest('hex').slice(0, 12);

export const findRegions = (source, file) => {
  const regions = [];
  const errors = [];
  let open;

  source.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const start = line.match(START);
    if (start) {
      if (open) {
        errors.push({ file, line: lineNumber, message: `Start marker inside the region opened at line ${open.start}` });
      } else {
        open = { name: start[1] || `${file}:${lineNumber}`, start: lineNumber, lines: [] };
      }
    } else if (END.test(line)) {
      if (open) {
        const code = open.lines.join('\n');
        regions.push({
          name: open.name,
          slug: slugify(open.name) || slugify(`${file}:${open.start}`),
          file,
          start: open.start,
          end: lineNumber,
          hash: hashCode(code),
          code,
        });
        open = undefined;
      } else {
        errors.push({ file, line: lineNumber, message: 'End marker without a Start marker' });
      }
    } else {
      open?.lines.push(line);
    }
  });

  if (open) errors.push({ file, line: open.start, message: 'Start marker without an End marker' });
  return { regions, errors };
};

export const findDuplicates = (regions) => {
  const seen = new Map();
  return regions.flatMap((region) => {
    const first = seen.get(region.slug);
    if (!first) {
      seen.set(region.slug, region);
      return [];
    }
    return [
      {
        file: region.file,
        line: region.start,
        message: `duplicate name "${region.name}" (also used at ${first.file}:${first.start})`,
      },
    ];
  });
};
