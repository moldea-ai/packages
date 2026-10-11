import { isDeepStrictEqual } from 'node:util';

import { CoreOperationException } from '@moldea.ai/core';
import { RepositorySourceException } from '@moldea.ai/repository';

import {
  CORE_DIAGNOSTIC_COVERAGE,
  CORE_OPERATION_COVERAGE,
  REQUIRED_CASE_IDS,
} from './coverage.ts';
import type { ICapabilities } from './types.ts';
import { getCapabilityShowcase } from './presentation.ts';

/**
 * Rejects a stale story rather than publishing an unexpected package result.
 * @throws
 * - A capability example produced unexpected facts.
 */
export const assertCapabilityFacts = (actual: unknown, expected: unknown): void => {
  if (!isDeepStrictEqual(actual, expected))
    throw new Error('A capability example produced unexpected facts.');
};

/**
 * Captures only an anticipated public operational refusal, without causes or host context.
 * @returns Safe fields from the real package exception.
 * @throws
 * - A capability example did not produce its expected operational refusal.
 */
export const captureOperationalRefusal = async (
  operation: () => Promise<unknown>,
  expectedCode: string,
) => {
  try {
    await operation();
  } catch (error: unknown) {
    if (
      (error instanceof CoreOperationException || error instanceof RepositorySourceException) &&
      error.code === expectedCode
    ) {
      return {
        source: error instanceof CoreOperationException ? 'core' : 'repository',
        code: error.code,
        operation: error.operation,
        retryable: error.retryable,
      };
    }
    throw error;
  }
  throw new Error('A capability example did not produce its expected operational refusal.');
};

/**
 * Validates the finite catalog against its release-owned inventory.
 * @throws
 * - A capability example produced unexpected facts.
 * - A capability source reference is missing or unsafe.
 * - A capability result is classified incorrectly.
 */
export const validateCapabilities = (catalog: ICapabilities, sourcePaths: Set<string>): void => {
  getCapabilityShowcase(catalog);
  const ids = catalog.cases.map(({ id }) => id);
  assertCapabilityFacts([...ids].sort(), [...REQUIRED_CASE_IDS].sort());
  assertCapabilityFacts(new Set(ids).size, ids.length);
  assertCapabilityFacts(
    catalog.groups.map(({ id }) => id),
    ['structure', 'agents', 'decisions', 'binding-coverage', 'repository-access', 'command-line'],
  );
  const byId = new Map(catalog.cases.map((example) => [example.id, example]));
  assertCapabilityFacts(
    Object.keys(catalog.coreOperations).sort(),
    Object.keys(CORE_OPERATION_COVERAGE).sort(),
  );
  assertCapabilityFacts(
    Object.keys(catalog.diagnostics).sort(),
    Object.keys(CORE_DIAGNOSTIC_COVERAGE).sort(),
  );
  for (const group of catalog.groups)
    assertCapabilityFacts(
      catalog.cases.some(({ groupId }) => groupId === group.id),
      true,
    );
  for (const example of catalog.cases) {
    assertCapabilityFacts(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(example.id), true);
    assertCapabilityFacts(
      catalog.groups.some(({ id }) => id === example.groupId),
      true,
    );
    assertCapabilityFacts(
      [example.title, example.description, example.limitation].every((copy) => copy.trim() !== ''),
      true,
    );
    if (
      example.sourcePaths.length === 0 ||
      example.sourcePaths.some(
        (source) =>
          !sourcePaths.has(source) ||
          source
            .split('/')
            .some(
              (part) => part === '..' || part.startsWith('_archive') || part.startsWith('_backup'),
            ) ||
          source.includes('\\'),
      )
    ) {
      throw new Error('A capability source reference is missing or unsafe.');
    }
    const result = example.result;
    if (
      result.kind === 'validation' &&
      result.valid !== result.diagnostics.every(({ severity }) => severity !== 'error')
    ) {
      throw new Error(`Capability result ${example.id} is classified incorrectly.`);
    }
    if (
      result.kind === 'cli' &&
      (result.schemaVersion !== 7 ||
        (result.status === 'valid'
          ? result.exitStatus !== 0
          : result.status === 'invalid'
            ? result.exitStatus !== 1
            : result.status !== 'error' || (result.exitStatus !== 2 && result.exitStatus !== 3)))
    ) {
      throw new Error(`Capability result ${example.id} is classified incorrectly.`);
    }
  }
  for (const [operation, caseIds] of Object.entries(catalog.coreOperations)) {
    assertCapabilityFacts(
      caseIds.length > 0 &&
        caseIds.every(
          (id) =>
            byId.get(id)?.operation === operation &&
            byId.get(id)?.packageName === '@moldea.ai/core',
        ),
      true,
    );
  }
  for (const [code, coverage] of Object.entries(catalog.diagnostics)) {
    assertCapabilityFacts(
      sourcePaths.has(coverage.sourcePath) && coverage.note.trim() !== '',
      true,
    );
    assertCapabilityFacts(coverage.mode === 'demonstrated', coverage.caseIds.length > 0);
    for (const id of coverage.caseIds) {
      const result = byId.get(id)?.result;
      assertCapabilityFacts(
        result?.kind === 'validation' &&
          result.diagnostics.some(
            (diagnostic) => diagnostic.source === 'core' && diagnostic.code === code,
          ),
        true,
      );
    }
  }
};
