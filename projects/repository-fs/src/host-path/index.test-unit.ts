// @vitest-environment node
import path from 'node:path';
import { describe, expect, test } from 'vitest';

import { isAbsoluteHostRootDirectory } from './index.js';

describe('host root path validation', () => {
  test('accepts one absolute scalar host path for the active platform', () => {
    expect(isAbsoluteHostRootDirectory(path.resolve('repository-root-🚀'))).toBe(true);
  });

  test.each(['\ud800', '\udc00', 'before\ud800after'])(
    'rejects an absolute host path holding the lone surrogate in %o',
    (segment) => {
      expect(isAbsoluteHostRootDirectory(path.resolve(segment))).toBe(false);
    },
  );

  test.skipIf(process.platform === 'win32')('accepts an absolute POSIX root', () => {
    expect(isAbsoluteHostRootDirectory('/repository')).toBe(true);
  });

  test.skipIf(process.platform !== 'win32')('accepts an absolute Windows drive root', () => {
    expect(isAbsoluteHostRootDirectory('C:\\repository')).toBe(true);
  });

  test.skipIf(process.platform !== 'win32')('accepts an absolute Windows UNC root', () => {
    expect(isAbsoluteHostRootDirectory('\\\\server\\share\\repository')).toBe(true);
  });

  test.each([
    ['', false],
    ['relative/path', false],
    ['relative\0path', false],
    ['\ud800', false],
    [null, false],
    [[], false],
  ])('isAbsoluteHostRootDirectory(%o) -> %s', (candidate, expectedResult) => {
    expect(isAbsoluteHostRootDirectory(candidate)).toBe(expectedResult);
  });
});
