// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { createMoldeaCliProjectScopeExecutor } from './executor.js';

describe('project scope execution', () => {
  test('reads only the manifest and matches relationships without adapters', async () => {
    const manifestPath = parseRepositoryPath('/moldea/moldea.yaml');
    const projectPath = parseRepositoryPath('/moldea/project.md');
    const manifestContent = [
      'version: 1',
      'context:',
      '  /moldea/project.md:',
      '    affectedBy:',
      '      - /src/**',
      '',
    ].join('\n');
    const reader = createMemoryRepositoryReader([
      { content: new TextEncoder().encode(manifestContent), path: manifestPath, type: 'file' },
      { content: new TextEncoder().encode('must not be read'), path: projectPath, type: 'file' },
    ]);
    const readPaths: string[] = [];
    const execute = createMoldeaCliProjectScopeExecutor();
    const result = await execute({
      paths: ['/unrelated.md', '/src/feature.ts'],
      repository: {
        getEntry: (path, options) => reader.getEntry(path, options),
        listEntries: (options) => reader.listEntries(options),
        readFile: (path, options) => {
          readPaths.push(path);
          return reader.readFile(path, options);
        },
      },
      resourceLimits: {
        maxDiagnostics: 16,
        maxEntries: 16,
        maxEvidence: 16,
        maxFileBytes: 1024,
        maxManifestBytes: 1024,
        maxTotalBytes: 4096,
      },
    });

    expect(result.scope).toMatchObject({
      counts: { declarations: 1, inputPaths: 2, matchedPaths: 1, matches: 1 },
      relevant: true,
      valid: true,
    });
    expect(result.scope.matches.map(({ inputPath }) => inputPath)).toStrictEqual([
      '/src/feature.ts',
    ]);
    expect(readPaths).toStrictEqual([manifestPath]);
  });
});
