// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { IMoldeaCliCompositionStateInput } from './types.js';
import { isMoldeaCliCompositionStateValid } from './validations.js';
import { createTestCompositionState } from './composition.test-fixtures.js';

describe('isMoldeaCliCompositionStateValid', () => {
  test('accepts the compatible declared and exact installed composition', () => {
    expect(isMoldeaCliCompositionStateValid(createTestCompositionState())).toBe(true);
  });

  test.each([
    [
      'missing dependency metadata',
      (state: IMoldeaCliCompositionStateInput): IMoldeaCliCompositionStateInput => ({
        ...state,
        packageMetadata: { ...state.packageMetadata, dependencies: null },
      }),
    ],
    [
      'an invalid Node.js range',
      (state: IMoldeaCliCompositionStateInput): IMoldeaCliCompositionStateInput => ({
        ...state,
        packageMetadata: { ...state.packageMetadata, supportedNodeRange: 'invalid' },
      }),
    ],
    [
      'an invalid Git version',
      (state: IMoldeaCliCompositionStateInput): IMoldeaCliCompositionStateInput => ({
        ...state,
        minimumGitVersion: 'invalid',
      }),
    ],
    [
      'an invalid JSON schema version',
      (state: IMoldeaCliCompositionStateInput): IMoldeaCliCompositionStateInput => ({
        ...state,
        outputSchemaVersion: 1 as 7,
      }),
    ],
  ])('rejects %s', (_description, mutate) => {
    expect(isMoldeaCliCompositionStateValid(mutate(createTestCompositionState()))).toBe(false);
  });

  test('requires the exact foundational dependency set', () => {
    const state = createTestCompositionState();
    const dependencies = { ...(state.packageMetadata.dependencies ?? {}) };
    delete dependencies['@moldea.ai/core'];

    expect(
      isMoldeaCliCompositionStateValid({
        ...state,
        packageMetadata: { ...state.packageMetadata, dependencies },
      }),
    ).toBe(false);
  });

  test.each([
    ['a future breaking major', '8.0.0'],
    ['a prerelease', '7.0.0-rc.1'],
  ])('rejects %s for a first-party package', (_description, version) => {
    const state = createTestCompositionState();

    expect(
      isMoldeaCliCompositionStateValid({
        ...state,
        packageMetadata: {
          ...state.packageMetadata,
          installedPackageVersions: {
            ...(state.packageMetadata.installedPackageVersions ?? {}),
            '@moldea.ai/core': version,
          },
        },
      }),
    ).toBe(false);
  });

  test('accepts a later compatible first-party release without changing the CLI manifest', () => {
    const state = createTestCompositionState();

    expect(
      isMoldeaCliCompositionStateValid({
        ...state,
        packageMetadata: {
          ...state.packageMetadata,
          installedPackageVersions: {
            ...(state.packageMetadata.installedPackageVersions ?? {}),
            '@moldea.ai/core': '7.9.9',
          },
        },
      }),
    ).toBe(true);
  });

  test.each(['5.0.1', '>=5.0.0'])('rejects an unsupported Core declaration %s', (range) => {
    const state = createTestCompositionState();

    expect(
      isMoldeaCliCompositionStateValid({
        ...state,
        packageMetadata: {
          ...state.packageMetadata,
          dependencies: {
            ...(state.packageMetadata.dependencies ?? {}),
            '@moldea.ai/core': range,
          },
        },
      }),
    ).toBe(false);
  });

  test.each(['2.0.0', '2.0.2'])(
    'rejects Repository FS %s below the corrected minimum',
    (version) => {
      const state = createTestCompositionState();
      expect(
        isMoldeaCliCompositionStateValid({
          ...state,
          packageMetadata: {
            ...state.packageMetadata,
            installedPackageVersions: {
              ...(state.packageMetadata.installedPackageVersions ?? {}),
              '@moldea.ai/repository-fs': version,
            },
          },
        }),
      ).toBe(false);
    },
  );
});
