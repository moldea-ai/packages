import type { IPublicPackage } from '../model/types.ts';
import type { IRuntimeCompatibilityPublicationV1 } from '../runtime-compatibility-publication/index.ts';

import { CAPABILITY_GROUPS } from './catalog.ts';
import {
  CORE_DIAGNOSTIC_COVERAGE,
  CORE_OPERATION_COVERAGE,
  RUNTIME_PATTERN_PROOFS,
} from './coverage.ts';
import { createCoreExamples, createCoreInspectionExamples } from './core-examples/index.ts';
import { createRuntimeExamples } from './runtime-examples/index.ts';
import { createReaderExamples } from './reader-examples/index.ts';
import { createCliExamples } from './cli-examples/index.ts';
import type { ICapabilities } from './types.ts';
import { validateCapabilities } from './validations.ts';

/**
 * Creates the complete source-backed catalog through public package APIs and the declared CLI bin.
 * Temporary filesystem/Git workspaces are removed before the promise resolves or rejects.
 * @returns Validated content for the internal website model, without new visitor routes.
 */
export const createCapabilities = async (
  repositoryRoot: string,
  packages: IPublicPackage[],
  publication: IRuntimeCompatibilityPublicationV1,
): Promise<ICapabilities> => {
  const cases = [
    ...(await createCoreExamples()),
    ...(await createCoreInspectionExamples()),
    ...(await createRuntimeExamples()),
    ...(await createReaderExamples()),
    ...(await createCliExamples(repositoryRoot, packages)),
  ];
  const catalog: ICapabilities = {
    groups: structuredClone(CAPABILITY_GROUPS),
    cases,
    coreOperations: structuredClone(CORE_OPERATION_COVERAGE),
    diagnostics: structuredClone(CORE_DIAGNOSTIC_COVERAGE),
    runtimeTargets: Object.entries(publication.adapters).flatMap(([adapterId, adapter]) =>
      (adapter.targets ?? []).map((target) => {
        const proofs = RUNTIME_PATTERN_PROOFS[`${adapterId}/${target.id}`];
        if (proofs === undefined) throw new Error('A runtime capability target has no coverage.');
        return {
          adapterId,
          target: structuredClone(target),
          scopeRoute: `/adapters/${adapterId}/#${adapterId}-${target.id}`,
          patterns: Object.entries(proofs).map(([id, proofs]) => ({
            id,
            proofs: structuredClone(proofs),
          })),
        };
      }),
    ),
  };
  validateCapabilities(
    catalog,
    publication,
    new Set([
      'specifications/repository-format.md',
      ...packages.flatMap(({ documents }) => documents.map(({ sourcePath }) => sourcePath)),
    ]),
  );
  return catalog;
};
