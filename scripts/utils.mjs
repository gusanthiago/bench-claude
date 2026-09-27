import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

export const fail = (message, code) => {
  console.error(`bench-claude: ${message}`);
  return code;
};

export const displayPath = (target) => {
  const relative = path.relative(process.cwd(), target);
  return relative.startsWith('..') || path.isAbsolute(relative) ? target : relative;
};

export const resolvesBenchNode = (file) => {
  try {
    createRequire(file).resolve('bench-node');
    return true;
  } catch {
    return false;
  }
};

export const gitInfo = (cwd) => {
  const git = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    return {
      commit: git('rev-parse', '--short', 'HEAD'),
      branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
      dirty: git('status', '--porcelain') !== '',
    };
  } catch {
    return null;
  }
};

export const collectEnvironment = (cwd, benchNode, loadAverage) => {
  const cpus = os.cpus();
  return {
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
    release: os.release(),
    cpu: cpus[0]?.model.trim() ?? 'unknown',
    cpus: cpus.length,
    memoryBytes: os.totalmem(),
    loadAverage,
    benchNode,
    git: gitInfo(cwd),
  };
};

export const readCapture = (captureFile) =>
  fs.existsSync(captureFile) ? JSON.parse(fs.readFileSync(captureFile, 'utf8')) : null;

const SOURCE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/;

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });

const gitFiles = (dir) =>
  execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .split('\0')
    .filter(Boolean)
    .map((file) => path.join(dir, file));

export const listSourceFiles = (target) => {
  if (!fs.statSync(target).isDirectory()) return [target];
  let files;
  try {
    files = gitFiles(target);
  } catch {
    files = walk(target);
  }
  return files.filter((file) => SOURCE_FILE.test(file) && fs.existsSync(file)).sort();
};
