import { isDeepStrictEqual } from 'node:util';

import { createCore } from '@moldea.ai/core';
import { parseRepositoryPath } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import type { ICapabilityCase } from '../index.ts';
import { projectDiagnostics, projectFile, validateRuntimeSourceProofs } from '../index.ts';

import { AGENT_EXAMPLES } from './agents.ts';
import { DECISION_EXAMPLES } from './decisions.ts';
import { CORE_EXPECTED_RESULTS } from './expected-results.ts';
import { STRUCTURE_EXAMPLES } from './structure.ts';
import type { ICoreExampleDefinition } from './types.ts';

// every authored case is executed once, before any display projection
export const CORE_EXAMPLES = [...STRUCTURE_EXAMPLES, ...AGENT_EXAMPLES, ...DECISION_EXAMPLES];

/**
 * Executes website-owned fixtures against public Core and memory-reader exports.
 * @returns The checked, content-bounded examples.
 * @throws
 * - A capability example produced unexpected Core results.
 */
export const createCoreExamples = async (
  definitions: ICoreExampleDefinition[] = CORE_EXAMPLES,
): Promise<ICapabilityCase[]> => {
  const core = createCore();
  const examples: ICapabilityCase[] = [];
  for (const definition of definitions) {
    const { text, operation } = definition;
    validateRuntimeSourceProofs(definition.id, definition.entries);
    const result =
      operation === 'validateProject'
        ? await core.validateProject({
            repository: createMemoryRepositoryReader(definition.entries),
          })
        : text === undefined
          ? null
          : await core[operation]({ path: parseRepositoryPath(text.path), content: text.content });
    const expectation = CORE_EXPECTED_RESULTS[definition.id];
    if (
      result === null ||
      expectation === undefined ||
      !isDeepStrictEqual(
        { valid: result.valid, diagnostics: structuredClone(result.diagnostics) },
        expectation,
      ) ||
      !isDeepStrictEqual(
        result.diagnostics.map(({ code }) => code),
        definition.expectedCodes,
      )
    ) {
      throw new Error('A capability example produced unexpected Core results.');
    }
    const entries = text === undefined ? definition.entries : [{ ...text, type: 'file' as const }];
    examples.push({
      id: definition.id,
      groupId: definition.groupId,
      title: definition.title,
      description: definition.description,
      operation,
      packageName: '@moldea.ai/core',
      limitation: 'A structural result does not establish application behavior or answer quality.',
      sourcePaths: ['projects/core/docs/diagnostics.md', 'specifications/repository-format.md'],
      files: entries.map(projectFile).filter((file) => file !== null),
      result: {
        kind: 'validation',
        valid: result.valid,
        diagnostics: projectDiagnostics(result.diagnostics),
      },
    });
  }
  return examples;
};
