// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { IRuntimeCompatibilityMatrix } from '../../../../../scripts/runtime-compatibility/types.ts';

import type { IRuntimeTargetMaturityRegistry } from '../runtime-target-maturity/index.ts';

import {
  createRuntimeCompatibilityPublication,
  serializeRuntimeCompatibilityPublication,
} from './runtime-compatibility-publication.ts';

const createMatrix = (): IRuntimeCompatibilityMatrix => ({
  adapters: {
    zeta: {
      implementation: {
        distribution: 'public',
        kind: 'package',
        package: '@moldea.ai/adapter-zeta',
      },
      implementationStatus: 'available',
      targets: [
        {
          id: 'typescript-zeta',
          kind: 'package',
          language: 'typescript',
          lastVerifiedAt: '2026-08-26',
          packages: [
            {
              ecosystem: 'npm',
              name: 'zeta',
              role: 'primary',
              versionRange: '^1.0.0',
            },
          ],
        },
        {
          id: 'typescript-alpha',
          kind: 'package',
          language: 'typescript',
          lastVerifiedAt: '2026-08-26',
          packages: [
            {
              ecosystem: 'npm',
              name: 'alpha',
              role: 'primary',
              versionRange: '^1.0.0',
            },
          ],
        },
      ],
    },
    alpha: {
      implementation: {
        distribution: 'public',
        kind: 'package',
        package: '@moldea.ai/adapter-alpha',
      },
      implementationStatus: 'planned',
    },
  },
  version: 2,
});

const createMaturities = (): IRuntimeTargetMaturityRegistry => ({
  zeta: {
    'typescript-alpha': 'supported',
    'typescript-zeta': 'experimental',
  },
});

describe('runtime compatibility publication', () => {
  test('combines complete technical records with exact maturity in deterministic order', () => {
    const matrix = createMatrix();
    const publication = createRuntimeCompatibilityPublication(matrix, createMaturities());

    expect(Object.keys(publication.adapters)).toStrictEqual(['alpha', 'zeta']);
    expect(publication.adapters['zeta']?.targets?.map(({ id }) => id)).toStrictEqual([
      'typescript-alpha',
      'typescript-zeta',
    ]);
    expect(publication.adapters['zeta']?.targets).toMatchObject([
      { id: 'typescript-alpha', maturity: 'supported', packages: [{ name: 'alpha' }] },
      { id: 'typescript-zeta', maturity: 'experimental', packages: [{ name: 'zeta' }] },
    ]);
    expect(publication).toMatchObject({ matrixVersion: 2, schemaVersion: 1 });
    expect(publication).not.toHaveProperty('generatedAt');
    expect(matrix.adapters['zeta']?.targets?.map(({ id }) => id)).toStrictEqual([
      'typescript-zeta',
      'typescript-alpha',
    ]);
  });

  test('serializes byte-identically for reversed adapter, target, and maturity enumeration', () => {
    const matrix = createMatrix();
    const reversedMatrix: IRuntimeCompatibilityMatrix = {
      adapters: Object.fromEntries(
        Object.entries(matrix.adapters)
          .reverse()
          .map(([adapterId, adapter]) => [
            adapterId,
            {
              ...adapter,
              targets: adapter.targets === undefined ? undefined : [...adapter.targets].reverse(),
            },
          ]),
      ),
      version: 2,
    };
    const maturities = createMaturities();
    const reversedMaturities: IRuntimeTargetMaturityRegistry = {
      zeta: Object.fromEntries(Object.entries(maturities['zeta'] ?? {}).reverse()),
    };

    expect(
      serializeRuntimeCompatibilityPublication(
        createRuntimeCompatibilityPublication(matrix, maturities),
      ),
    ).toBe(
      serializeRuntimeCompatibilityPublication(
        createRuntimeCompatibilityPublication(reversedMatrix, reversedMaturities),
      ),
    );
  });

  test('rejects missing, stale, and invalid maturity values', () => {
    expect(() => createRuntimeCompatibilityPublication(createMatrix(), {})).toThrow(
      'Runtime target maturity is missing for zeta/typescript-alpha.',
    );
    expect(() =>
      createRuntimeCompatibilityPublication(createMatrix(), {
        ...createMaturities(),
        stale: { target: 'experimental' },
      }),
    ).toThrow('Runtime target maturity contains unknown or stale target stale/target.');
    expect(() =>
      createRuntimeCompatibilityPublication(createMatrix(), {
        zeta: {
          ...createMaturities()['zeta'],
          'typescript-alpha': 'invalid' as 'experimental',
        },
      }),
    ).toThrow('Runtime target maturity is invalid for zeta/typescript-alpha.');
  });

  test('emits compact recursively key-ordered JSON with one trailing LF', () => {
    const serialized = serializeRuntimeCompatibilityPublication(
      createRuntimeCompatibilityPublication(createMatrix(), createMaturities()),
    );

    expect(serialized.endsWith('\n')).toBe(true);
    expect(serialized.endsWith('\n\n')).toBe(false);
    expect(serialized.slice(0, -1)).not.toContain('\n');
    expect(serialized.startsWith('{"adapters":')).toBe(true);
    expect(serialized.endsWith(',"matrixVersion":2,"schemaVersion":1}\n')).toBe(true);
    expect(JSON.parse(serialized)).toStrictEqual(
      createRuntimeCompatibilityPublication(createMatrix(), createMaturities()),
    );
  });
});
