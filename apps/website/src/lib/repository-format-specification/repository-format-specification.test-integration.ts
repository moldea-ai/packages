// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCore } from '@moldea.ai/core';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';
import { describe, expect, test } from 'vitest';

import {
  loadRepositoryFormatSpecification,
  parseRepositoryFormatSpecification,
} from './repository-format-specification.ts';

const EXPECTED_MANIFEST_PROPERTY_PATHS = [
  'version',
  'context',
  'context.{context-path}.bindings',
  'context.{context-path}.bindings[].path',
  'context.{context-path}.bindings[].symbol',
  'context.{context-path}.affectedBy',
  'context.{context-path}.affectedBy[]',
  'decisions',
  'decisions.{decision-path}.bindings',
  'decisions.{decision-path}.bindings[].path',
  'decisions.{decision-path}.bindings[].symbol',
  'decisions.{decision-path}.affectedBy',
  'decisions.{decision-path}.affectedBy[]',
  'unresolved',
  'unresolved.{requirement-id}.category',
  'unresolved.{requirement-id}.effect',
  'unresolved.{requirement-id}.description',
  'unresolved.{requirement-id}.resolution',
  'unresolved.{requirement-id}.related',
  'unresolved.{requirement-id}.related[].path',
  'unresolved.{requirement-id}.related[].symbol',
  'unresolved.{requirement-id}.reference',
  'agents',
  'agents.{agent-id}.runtime',
  'agents.{agent-id}.runtime.id',
  'agents.{agent-id}.runtime.guidance',
  'agents.{agent-id}.context',
  'agents.{agent-id}.context[]',
  'agents.{agent-id}.decisions',
  'agents.{agent-id}.decisions[]',
  'agents.{agent-id}.variables',
  'agents.{agent-id}.variables.{variable-name}.description',
  'agents.{agent-id}.bindings',
  'agents.{agent-id}.bindings.runtimeAgent',
  'agents.{agent-id}.bindings.runtimeAgent.path',
  'agents.{agent-id}.bindings.runtimeAgent.symbol',
  'agents.{agent-id}.bindings.inputSchema',
  'agents.{agent-id}.bindings.inputSchema.path',
  'agents.{agent-id}.bindings.inputSchema.symbol',
  'agents.{agent-id}.bindings.outputSchema',
  'agents.{agent-id}.bindings.outputSchema.path',
  'agents.{agent-id}.bindings.outputSchema.symbol',
  'agents.{agent-id}.bindings.instructionLoader',
  'agents.{agent-id}.bindings.instructionLoader.path',
  'agents.{agent-id}.bindings.instructionLoader.symbol',
  'agents.{agent-id}.bindings.variableProviders',
  'agents.{agent-id}.bindings.variableProviders.{variable-name}.path',
  'agents.{agent-id}.bindings.variableProviders.{variable-name}.symbol',
  'agents.{agent-id}.tools',
  'agents.{agent-id}.tools.{tool-id}.name',
  'agents.{agent-id}.tools.{tool-id}.description',
  'agents.{agent-id}.tools.{tool-id}.implementation',
  'agents.{agent-id}.tools.{tool-id}.implementation.path',
  'agents.{agent-id}.tools.{tool-id}.implementation.symbol',
  'agents.{agent-id}.tools.{tool-id}.registration',
  'agents.{agent-id}.tools.{tool-id}.registration.path',
  'agents.{agent-id}.tools.{tool-id}.registration.symbol',
  'agents.{agent-id}.tools.{tool-id}.inputSchema',
  'agents.{agent-id}.tools.{tool-id}.inputSchema.path',
  'agents.{agent-id}.tools.{tool-id}.inputSchema.symbol',
  'agents.{agent-id}.tools.{tool-id}.outputSchema',
  'agents.{agent-id}.tools.{tool-id}.outputSchema.path',
  'agents.{agent-id}.tools.{tool-id}.outputSchema.symbol',
  'agents.{agent-id}.tools.{tool-id}.affectedBy',
  'agents.{agent-id}.tools.{tool-id}.affectedBy[]',
  'agents.{agent-id}.skills',
  'agents.{agent-id}.skills.{skill-id}.name',
  'agents.{agent-id}.skills.{skill-id}.description',
  'agents.{agent-id}.skills.{skill-id}.implementation',
  'agents.{agent-id}.skills.{skill-id}.implementation.path',
  'agents.{agent-id}.skills.{skill-id}.implementation.symbol',
  'agents.{agent-id}.skills.{skill-id}.registration',
  'agents.{agent-id}.skills.{skill-id}.registration.path',
  'agents.{agent-id}.skills.{skill-id}.registration.symbol',
  'agents.{agent-id}.skills.{skill-id}.affectedBy',
  'agents.{agent-id}.skills.{skill-id}.affectedBy[]',
  'agents.{agent-id}.affectedBy',
  'agents.{agent-id}.affectedBy[]',
  'agents.{agent-id}.mirrors',
  'agents.{agent-id}.mirrors[]',
  'agents.{agent-id}.unresolved',
  'agents.{agent-id}.unresolved.{requirement-id}.category',
  'agents.{agent-id}.unresolved.{requirement-id}.effect',
  'agents.{agent-id}.unresolved.{requirement-id}.description',
  'agents.{agent-id}.unresolved.{requirement-id}.resolution',
  'agents.{agent-id}.unresolved.{requirement-id}.related',
  'agents.{agent-id}.unresolved.{requirement-id}.related[].path',
  'agents.{agent-id}.unresolved.{requirement-id}.related[].symbol',
  'agents.{agent-id}.unresolved.{requirement-id}.reference',
] as const;

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const specificationSource = readFileSync(
  resolve(repositoryRoot, 'specifications/repository-format.md'),
  'utf8',
);

describe('Repository Format specification', () => {
  test('publishes the exact version 1 manifest property surface', () => {
    const specification = loadRepositoryFormatSpecification();

    expect(specification.propertyPaths).toStrictEqual([...EXPECTED_MANIFEST_PROPERTY_PATHS]);
  });

  test('executes every marked complete example through the public Core boundary', async () => {
    const specification = loadRepositoryFormatSpecification();

    for (const example of specification.completeExamples) {
      const result = await createCore().validateProject({
        repository: createMemoryRepositoryReader(
          example.files.map((file) => ({
            content: file.content,
            path: file.path,
            type: 'file' as const,
          })),
        ),
      });

      expect(result.valid, example.id).toBe(true);
      expect(result.diagnostics, example.id).toStrictEqual([]);
      expect(result.formatVersion, example.id).toBe(1);
    }
  });

  test('rejects unknown metadata, duplicate properties, missing anchors, and unmarked examples', () => {
    expect(() =>
      parseRepositoryFormatSpecification(
        specificationSource.replace('formatVersion: 1', 'formatVersion: 1\nowner: packages'),
      ),
    ).toThrow();
    expect(() =>
      parseRepositoryFormatSpecification(
        specificationSource.replace(/^(\|\s+`version`[^\n]+\n)/mu, '$1$1'),
      ),
    ).toThrow('duplicate manifest property paths');
    expect(() =>
      parseRepositoryFormatSpecification(
        specificationSource.replace(
          'The repository format follows one central rule:',
          '[Missing](#missing-heading)\n\nThe repository format follows one central rule:',
        ),
      ),
    ).toThrow('missing anchor');
    expect(() =>
      parseRepositoryFormatSpecification(
        specificationSource.replaceAll('repository-example:minimal:', 'ordinary-example:minimal:'),
      ),
    ).toThrow('no marked complete repository example');
  });
});
