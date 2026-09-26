import { isDeepStrictEqual } from 'node:util';
import { parseDocument } from 'yaml';

import { createCore } from '@moldea.ai/core';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { INSPECTION_SNAPSHOTS } from './constants.ts';
import type { IInspectionExampleState, IInspectionSnapshot } from './types.ts';

/**
 * Validates the three synthetic snapshots through public Core and reader exports.
 * Rejects changed results instead of publishing an inaccurate demonstration.
 * @returns The file paths and content-free excerpts from actual Core results.
 * @throws
 * - If snapshots are malformed, out of order, or produce unexpected Core results.
 */
export const createInspectionExample = async (
  snapshots: IInspectionSnapshot[] = INSPECTION_SNAPSHOTS,
): Promise<IInspectionExampleState[]> => {
  if (
    !isDeepStrictEqual(
      snapshots.map(({ id }) => id),
      ['connected', 'broken', 'repaired'],
    )
  ) {
    throw new Error('The inspection example must contain connected, broken, and repaired states.');
  }

  const core = createCore();
  const states: IInspectionExampleState[] = [];

  for (const snapshot of snapshots) {
    const repository = createMemoryRepositoryReader([
      { path: '/moldea/moldea.yaml', type: 'file', content: snapshot.manifest },
      { path: '/moldea/project.md', type: 'file', content: snapshot.project },
      { path: snapshot.sourcePath, type: 'file', content: snapshot.source },
    ]);
    const validation = await core.validateProject({ repository });
    const declaredPath: unknown = parseDocument(snapshot.manifest).getIn([
      'context',
      '/moldea/project.md',
      'bindings',
      0,
      'path',
    ]);
    const { valid, errorCount, warningCount } = validation;
    // compare diagnostic content, independent of Core's null-prototype detail records
    const diagnostics = structuredClone(validation.diagnostics);
    const expectedDiagnostics =
      snapshot.id === 'broken'
        ? [
            {
              code: 'MOLDEA_REFERENCE_MISSING',
              message: 'The referenced repository path does not exist.',
              path: '/moldea/moldea.yaml',
              pointer: '/context/~1moldea~1project.md/bindings/0',
              details: { referencedPath: '/src/refund-policy.ts' },
              entity: null,
              range: null,
              severity: 'error',
              source: 'core',
            },
          ]
        : [];

    if (
      typeof declaredPath !== 'string' ||
      valid !== (snapshot.id !== 'broken') ||
      errorCount !== (snapshot.id === 'broken' ? 1 : 0) ||
      warningCount !== 0 ||
      !isDeepStrictEqual(diagnostics, expectedDiagnostics)
    ) {
      throw new Error(
        `The inspection example produced unexpected Core results for ${snapshot.id}.`,
      );
    }

    const result = {
      valid,
      errorCount,
      warningCount,
      diagnostics: diagnostics.map(({ code, message, path, pointer, details, severity }) => ({
        code,
        message,
        path,
        pointer,
        details,
        severity,
      })),
    };
    states.push({
      id: snapshot.id,
      label: snapshot.label,
      explanation: snapshot.explanation,
      projectPath: '/moldea/project.md',
      declaredPath,
      sourcePath: snapshot.sourcePath,
      result,
    });
  }

  return states;
};
