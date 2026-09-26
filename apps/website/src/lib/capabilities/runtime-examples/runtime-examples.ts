import { isDeepStrictEqual } from 'node:util';

import { createCore } from '@moldea.ai/core';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import type { ICapabilityCase } from '../index.ts';
import { projectDiagnostics, projectEvidence, projectFile } from '../index.ts';
import { validateRuntimeSourceProofs } from '../index.ts';

import { RUNTIME_EXPECTED_RESULTS } from './expected-results.ts';
import { RUNTIME_EXAMPLES } from './fixtures.ts';
import type { IRuntimeExampleDefinition } from './types.ts';

/**
 * Inspects synthetic source without importing its SDKs or executing its application code.
 * @returns Examples whose complete diagnostics and relationship evidence match reviewed results.
 * @throws
 * - A runtime capability example produced unexpected results.
 */
export const createRuntimeExamples = async (
  definitions: IRuntimeExampleDefinition[] = RUNTIME_EXAMPLES,
): Promise<ICapabilityCase[]> => {
  const examples: ICapabilityCase[] = [];
  for (const definition of definitions) {
    validateRuntimeSourceProofs(definition.id, definition.files);
    const result = await createCore({ adapters: [definition.adapter] }).validateProject({
      repository: createMemoryRepositoryReader(definition.files),
    });
    if (
      !isDeepStrictEqual(
        structuredClone({
          valid: result.valid,
          diagnostics: result.diagnostics,
          evidence: result.evidence,
          manifestDigest: result.summary?.manifestDigest ?? null,
        }),
        RUNTIME_EXPECTED_RESULTS[definition.id],
      )
    ) {
      throw new Error('A runtime capability example produced unexpected results.');
    }
    examples.push({
      id: definition.id,
      groupId: 'runtime-wiring',
      title: definition.title,
      description: definition.description,
      packageName: `@moldea.ai/adapter-${definition.adapter.id}`,
      operation: 'validateProject',
      limitation:
        'Only the documented static patterns are inspected. Source excerpts do not prove SDK type correctness, schema equivalence, model behavior, or turn-time availability.',
      sourcePaths: [
        `projects/adapter-${definition.adapter.id}/docs/${definition.adapter.id === 'cloudflare-agents' ? 'verified-targets' : 'verified-target'}.md`,
        `projects/adapter-${definition.adapter.id}/docs/limitations.md`,
      ],
      files: definition.files.map(projectFile).filter((file) => file !== null),
      result: {
        kind: 'adapter',
        valid: result.valid,
        errorCount: result.errorCount,
        warningCount: result.warningCount,
        diagnostics: projectDiagnostics(result.diagnostics),
        evidence: projectEvidence(result.evidence),
      },
    });
  }
  return examples;
};
