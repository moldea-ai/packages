// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { IMoldeaCliCompositionStateInput } from './types.js';
import { isMoldeaCliCompositionStateValid } from './validations.js';
import {
  createTestCompositionState,
  createTestRuntimeAdapter,
} from './composition.test-fixtures.js';

describe('isMoldeaCliCompositionStateValid', () => {
  test('accepts the exact installed and executable composition', () => {
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
        outputSchemaVersion: 1 as 2,
      }),
    ],
  ])('rejects %s', (_description, mutate) => {
    expect(isMoldeaCliCompositionStateValid(mutate(createTestCompositionState()))).toBe(false);
  });

  test('requires the exact foundational and active-adapter dependency set', () => {
    const state = createTestCompositionState();
    const dependencies = { ...(state.packageMetadata.dependencies ?? {}) };
    delete dependencies['@moldea.ai/adapter-openai'];

    expect(
      isMoldeaCliCompositionStateValid({
        ...state,
        packageMetadata: { ...state.packageMetadata, dependencies },
      }),
    ).toBe(false);
  });

  test('requires declared and resolved package versions to match exactly', () => {
    const state = createTestCompositionState();

    expect(
      isMoldeaCliCompositionStateValid({
        ...state,
        packageMetadata: {
          ...state.packageMetadata,
          installedPackageVersions: {
            ...(state.packageMetadata.installedPackageVersions ?? {}),
            '@moldea.ai/core': '9.0.0',
          },
        },
      }),
    ).toBe(false);
  });

  test.each([
    ['duplicate IDs', [createTestRuntimeAdapter('openai'), createTestRuntimeAdapter('openai')]],
    ['the built-in custom ID', [createTestRuntimeAdapter('custom')]],
    ['an invalid ID', [createTestRuntimeAdapter('OpenAI')]],
    ['an unsupported format', [createTestRuntimeAdapter('openai', [2 as 1])]],
  ])('rejects active adapters with %s', (_description, activeAdapters) => {
    const state = createTestCompositionState();

    expect(isMoldeaCliCompositionStateValid({ ...state, activeAdapters })).toBe(false);
  });

  test('treats active adapter order as semantically irrelevant', () => {
    const state = createTestCompositionState();

    expect(
      isMoldeaCliCompositionStateValid({
        ...state,
        activeAdapters: [...state.activeAdapters].reverse(),
      }),
    ).toBe(true);
  });
});
