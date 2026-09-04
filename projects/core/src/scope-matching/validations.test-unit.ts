// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath, RepositoryPathException } from '@moldea.ai/repository';

import { DEFAULT_CORE_RESOURCE_LIMITS } from '../constants/index.js';
import { CoreOperationException } from '../exceptions/index.js';

import { normalizeManifestScopeInput } from './validations.js';

const manifest = {
  content: 'version: 1\n',
  path: parseRepositoryPath('/moldea/moldea.yaml'),
} as const;

describe('manifest scope input validation', () => {
  test('snapshots, deduplicates, and deterministically sorts repository paths', () => {
    const input = { manifest, paths: ['/z.ts', '/a.ts', '/z.ts'] };
    const normalized = normalizeManifestScopeInput(input, DEFAULT_CORE_RESOURCE_LIMITS);

    input.paths.push('/later.ts');

    expect(normalized).toStrictEqual({
      manifest,
      paths: ['/a.ts', '/z.ts'],
    });
  });

  test.each([
    null,
    {},
    { manifest, paths: null },
    { manifest, paths: [1] },
    { manifest: null, paths: [] },
  ])('rejects malformed public input %o', (input) => {
    expect(() =>
      normalizeManifestScopeInput(input as never, DEFAULT_CORE_RESOURCE_LIMITS),
    ).toThrowError(
      expect.objectContaining({
        code: 'INVALID_ARGUMENT',
        operation: 'match-manifest-scope',
      }),
    );
  });

  test.each([
    '',
    'relative/file.ts',
    'C:drive-relative.ts',
    '//server/share.ts',
    '\\\\?\\C:\\device.ts',
    '/C:/native.ts',
    '/src//file.ts',
    '/src/./file.ts',
    '/src/../file.ts',
    '/src\\file.ts',
    '/src/with\0nul.ts',
  ])('rejects non-logical changed path %s', (path) => {
    expect(() =>
      normalizeManifestScopeInput({ manifest, paths: [path] }, DEFAULT_CORE_RESOURCE_LIMITS),
    ).toThrowError(RepositoryPathException);
  });

  test('enforces the raw changed-path count before deduplication', () => {
    expect(() =>
      normalizeManifestScopeInput(
        { manifest, paths: ['/same.ts', '/same.ts'] },
        { ...DEFAULT_CORE_RESOURCE_LIMITS, maxEntries: 1 },
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'RESOURCE_LIMIT_EXCEEDED',
        limit: 'maxEntries',
        operation: 'match-manifest-scope',
      }),
    );
  });

  test('enforces the aggregate changed-path UTF-8 byte budget', () => {
    expect(() =>
      normalizeManifestScopeInput(
        { manifest, paths: ['/é.ts'] },
        { ...DEFAULT_CORE_RESOURCE_LIMITS, maxTotalBytesRead: 5 },
      ),
    ).toThrowError(CoreOperationException);
    expect(() =>
      normalizeManifestScopeInput(
        { manifest, paths: ['/é.ts'] },
        { ...DEFAULT_CORE_RESOURCE_LIMITS, maxTotalBytesRead: 5 },
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'RESOURCE_LIMIT_EXCEEDED',
        limit: 'maxTotalBytesRead',
        operation: 'match-manifest-scope',
      }),
    );
  });
});
