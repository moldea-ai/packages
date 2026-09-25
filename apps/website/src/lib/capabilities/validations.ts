import { isDeepStrictEqual } from 'node:util';

import { CoreOperationException } from '@moldea.ai/core';
import { RepositorySourceException } from '@moldea.ai/repository';
import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

import type { IRuntimeCompatibilityPublicationV1 } from '../runtime-compatibility-publication/index.ts';

import {
  CORE_DIAGNOSTIC_COVERAGE,
  CORE_OPERATION_COVERAGE,
  REQUIRED_CASE_IDS,
  RUNTIME_PATTERN_PROOFS,
} from './coverage.ts';
import type { ICapabilities, ICapabilityCase, IRuntimePatternProof } from './types.ts';

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

/** Verifies the illustrated syntax against the complete executed file, before excerpt selection. */
export const validateRuntimeSourceProofs = (
  caseId: string,
  files: IMemoryRepositoryEntry[],
): void => {
  for (const patterns of Object.values(RUNTIME_PATTERN_PROOFS)) {
    for (const proofs of Object.values(patterns)) {
      for (const proof of proofs.filter((proof) => proof.caseId === caseId)) {
        const file = files.find(({ path }) => path === proof.source.path);
        if (
          proof.source.contains.trim() === '' ||
          file?.type !== 'file' ||
          typeof file.content !== 'string' ||
          !file.content.includes(proof.source.contains)
        ) {
          throw new Error(
            'A runtime capability source no longer demonstrates its claimed pattern.',
          );
        }
      }
    }
  }
};

/** Requires an independently executed witness instead of treating a matrix label as proof. */
export const validateRuntimeWitness = (
  proof: IRuntimePatternProof,
  example: ICapabilityCase,
): void => {
  const { result } = example;
  const { witness } = proof;
  if (witness.kind === 'validation') {
    assertCapabilityFacts(result.kind === 'validation' && result.valid, true);
    return;
  }
  if (result.kind !== 'adapter')
    throw new Error('A runtime capability witness has the wrong result family.');
  if (witness.kind === 'diagnostic') {
    assertCapabilityFacts(
      !result.valid && result.diagnostics.some(({ code }) => code === witness.code),
      true,
    );
    return;
  }
  const matching = result.evidence.filter(
    (entry) => entry.kind === witness.evidenceKind && entry.agentId === witness.agentId,
  );
  if (witness.kind === 'absence') {
    assertCapabilityFacts([result.valid, matching.length], [true, 0]);
    return;
  }
  assertCapabilityFacts(
    matching.some(
      (entry) =>
        (witness.runtimeName === undefined || entry.runtimeName === witness.runtimeName) &&
        Object.entries(witness.details ?? {}).every(
          ([key, expected]) => entry.details[key] === expected,
        ),
    ),
    true,
  );
};

/**
 * Validates the finite catalog against its release-owned inventory and canonical runtime publication.
 * @throws
 * - A capability example produced unexpected facts.
 * - A capability source reference is missing or unsafe.
 * - A capability result is classified incorrectly.
 * - A runtime capability witness has the wrong result family.
 */
export const validateCapabilities = (
  catalog: ICapabilities,
  publication: IRuntimeCompatibilityPublicationV1,
  sourcePaths: Set<string>,
): void => {
  const ids = catalog.cases.map(({ id }) => id);
  assertCapabilityFacts([...ids].sort(), [...REQUIRED_CASE_IDS].sort());
  assertCapabilityFacts(new Set(ids).size, ids.length);
  assertCapabilityFacts(
    catalog.groups.map(({ id }) => id),
    ['structure', 'agents', 'decisions', 'runtime-wiring', 'repository-access', 'command-line'],
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
      (result.kind === 'validation' || result.kind === 'adapter') &&
      result.valid !== result.diagnostics.every(({ severity }) => severity !== 'error')
    ) {
      throw new Error(`Capability result ${example.id} is classified incorrectly.`);
    }
    if (
      result.kind === 'cli' &&
      (result.schemaVersion !== 5 ||
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
  const canonicalTargets = Object.entries(publication.adapters).flatMap(([adapterId, adapter]) =>
    (adapter.targets ?? []).map((target) => ({ adapterId, target })),
  );
  assertCapabilityFacts(
    Object.keys(RUNTIME_PATTERN_PROOFS).sort(),
    canonicalTargets.map(({ adapterId, target }) => `${adapterId}/${target.id}`).sort(),
  );
  assertCapabilityFacts(
    catalog.runtimeTargets.map(({ adapterId, target }) => `${adapterId}/${target.id}`).sort(),
    canonicalTargets.map(({ adapterId, target }) => `${adapterId}/${target.id}`).sort(),
  );
  for (const runtime of catalog.runtimeTargets) {
    const key = `${runtime.adapterId}/${runtime.target.id}`;
    const canonical = canonicalTargets.find(
      ({ adapterId, target }) => `${adapterId}/${target.id}` === key,
    );
    assertCapabilityFacts(runtime.target, canonical?.target);
    assertCapabilityFacts(
      runtime.scopeRoute,
      `/adapters/${runtime.adapterId}/#${runtime.adapterId}-${runtime.target.id}`,
    );
    if (runtime.target.qualificationEvidence !== undefined) {
      const url = new URL(runtime.target.qualificationEvidence.url);
      assertCapabilityFacts(
        url.protocol === 'https:' && url.username === '' && url.password === '',
        true,
      );
    }
    const supported = (runtime.target.patterns ?? []).filter(
      ({ support }) => support === 'full' || support === 'partial',
    );
    assertCapabilityFacts(
      runtime.patterns.map(({ id }) => id).sort(),
      supported.map(({ id }) => id).sort(),
    );
    for (const pattern of runtime.patterns) {
      assertCapabilityFacts(pattern.proofs, RUNTIME_PATTERN_PROOFS[key]?.[pattern.id]);
      assertCapabilityFacts(pattern.proofs.length > 0, true);
      for (const proof of pattern.proofs) {
        const example = byId.get(proof.caseId);
        if (example === undefined)
          throw new Error('A runtime capability proof references a missing example.');
        assertCapabilityFacts(
          example.packageName,
          runtime.adapterId === 'custom'
            ? '@moldea.ai/core'
            : `@moldea.ai/adapter-${runtime.adapterId}`,
        );
        validateRuntimeWitness(proof, example);
      }
    }
  }
};
