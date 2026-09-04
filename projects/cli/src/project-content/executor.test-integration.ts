// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { createMoldeaCliProjectContentExecutor } from './executor.js';

describe('project content execution', () => {
  test('reads only one bounded Unicode-safe canonical range', async () => {
    const projectPath = parseRepositoryPath('/moldea/project.md');
    const reader = createMemoryRepositoryReader([
      { content: '# Project 😀\ncontinued\n', path: projectPath, type: 'file' },
      { content: 'private body', path: '/moldea/context/private.md', type: 'file' },
    ]);
    const execute = createMoldeaCliProjectContentExecutor();
    const result = await execute({
      maxBytes: 14,
      offset: 0,
      path: projectPath,
      repository: reader,
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
      byteEnd: 14,
      byteStart: 0,
      content: '# Project 😀',
      isComplete: false,
      nextOffset: 14,
      path: projectPath,
    });
    expect(result.contentIdentity).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });
});
