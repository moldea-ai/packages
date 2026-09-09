// @vitest-environment node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { cleanWebsiteBuild } from './clean-build.ts';

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'moldea-website-clean-'));
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

test('removes nested stale artifacts and the model while preserving sources and caches', () => {
  for (const path of [
    'dist/retired/index.html',
    '.generated/model.json',
    'src/index.astro',
    '.turbo/cache/retained.json',
    'node_modules/retained.js',
  ]) {
    const segments = path.split('/');
    mkdirSync(join(directory, ...segments.slice(0, -1)), { recursive: true });
    writeFileSync(join(directory, ...segments), path);
  }

  cleanWebsiteBuild(directory);

  expect(existsSync(join(directory, 'dist'))).toBe(false);
  expect(existsSync(join(directory, '.generated'))).toBe(false);
  for (const segments of [
    ['src', 'index.astro'],
    ['.turbo', 'cache', 'retained.json'],
    ['node_modules', 'retained.js'],
  ]) {
    expect(readFileSync(join(directory, ...segments), 'utf8')).toBe(segments.join('/'));
  }
});

test('is safe to repeat when outputs do not exist', () => {
  expect(() => {
    cleanWebsiteBuild(directory);
    cleanWebsiteBuild(directory);
  }).not.toThrow();
  expect(existsSync(directory)).toBe(true);
});

test('removes linked output directories without following them into other content', () => {
  const websiteDirectory = join(directory, 'website');
  const retainedDirectory = join(directory, 'retained');
  mkdirSync(websiteDirectory);
  mkdirSync(retainedDirectory);
  writeFileSync(join(retainedDirectory, 'model.json'), 'retained');
  for (const name of ['dist', '.generated']) {
    symlinkSync(retainedDirectory, join(websiteDirectory, name), 'junction');
  }

  cleanWebsiteBuild(websiteDirectory);

  expect(existsSync(join(websiteDirectory, 'dist'))).toBe(false);
  expect(existsSync(join(websiteDirectory, '.generated'))).toBe(false);
  expect(readFileSync(join(retainedDirectory, 'model.json'), 'utf8')).toBe('retained');
});
