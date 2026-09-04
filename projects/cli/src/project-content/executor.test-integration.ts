// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { createMoldeaCliProjectContentExecutor } from './executor.js';

describe('project content execution', () => {
  test('reads and digests exactly one explicit canonical asset', async () => {
    const projectPath = parseRepositoryPath('/moldea/project.md');
    const otherPath = parseRepositoryPath('/moldea/context/private.md');
    const reader = createMemoryRepositoryReader([
      { content: new TextEncoder().encode('# Project 😀\n'), path: projectPath, type: 'file' },
      { content: new TextEncoder().encode('private body'), path: otherPath, type: 'file' },
    ]);
    const readPaths: string[] = [];
    const execute = createMoldeaCliProjectContentExecutor();
    const result = await execute({
      path: projectPath,
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

    expect(result).toMatchObject({
      content: '# Project 😀\n',
      path: projectPath,
      scalarLength: 12,
      utf8ByteLength: 15,
    });
    expect(result.digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(readPaths).toStrictEqual([projectPath]);
  });
});
