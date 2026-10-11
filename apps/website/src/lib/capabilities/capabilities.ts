import type { IPublicPackage } from '../model/types.ts';

import { CAPABILITY_GROUPS } from './catalog.ts';
import { CORE_DIAGNOSTIC_COVERAGE, CORE_OPERATION_COVERAGE } from './coverage.ts';
import { createCoreExamples, createCoreInspectionExamples } from './core-examples/index.ts';
import { createBindingExamples } from './binding-examples/index.ts';
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
): Promise<ICapabilities> => {
  const cases = [
    ...(await createCoreExamples()),
    ...(await createCoreInspectionExamples()),
    ...(await createBindingExamples()),
    ...(await createReaderExamples()),
    ...(await createCliExamples(repositoryRoot, packages)),
  ];
  const catalog: ICapabilities = {
    groups: structuredClone(CAPABILITY_GROUPS),
    cases,
    coreOperations: structuredClone(CORE_OPERATION_COVERAGE),
    diagnostics: structuredClone(CORE_DIAGNOSTIC_COVERAGE),
  };
  validateCapabilities(
    catalog,
    new Set([
      'specifications/repository-format.md',
      ...packages.flatMap(({ documents }) => documents.map(({ sourcePath }) => sourcePath)),
    ]),
  );
  return catalog;
};
