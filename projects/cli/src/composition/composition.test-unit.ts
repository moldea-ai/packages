// @vitest-environment node
import { describe, expect, test } from 'vitest';

import {
  resolveInstalledMoldeaCliComposition,
  resolveMoldeaCliComposition,
} from './composition.js';
import {
  createTestCompositionState,
  INSTALLED_PACKAGE_METADATA,
} from './composition.test-fixtures.js';

describe('CLI composition resolution', () => {
  test('returns one all-or-nothing valid result for explicit state', () => {
    const resolution = resolveMoldeaCliComposition(createTestCompositionState());

    expect(resolution.kind).toBe('valid');
    expect(Object.isFrozen(resolution)).toBe(true);
  });

  test('returns the shared invalid outcome without a partial result', () => {
    const state = createTestCompositionState();
    const resolution = resolveMoldeaCliComposition({
      ...state,
      packageMetadata: { ...state.packageMetadata, dependencies: null },
    });

    expect(resolution).toStrictEqual({ kind: 'invalid' });
    expect(resolution).not.toHaveProperty('result');
    expect(Object.isFrozen(resolution)).toBe(true);
  });

  test('derives installed composition without generated release metadata', () => {
    expect(
      resolveInstalledMoldeaCliComposition({ packageMetadata: INSTALLED_PACKAGE_METADATA }).kind,
    ).toBe('valid');
  });
});
