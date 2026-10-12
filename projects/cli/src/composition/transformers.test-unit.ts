// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { createTestCompositionState } from './composition.test-fixtures.js';
import { createMoldeaCliCompositionResult } from './transformers.js';

describe('createMoldeaCliCompositionResult', () => {
  test('reports only executable technical composition state', () => {
    const result = createMoldeaCliCompositionResult(createTestCompositionState());

    expect(result).toMatchObject({
      minimumGitVersion: '2.30.0',
      repositoryFormatVersions: [1],
      supportedNodeRange: '>=22.11.0',
    });
    expect(result.packages).toStrictEqual([
      { name: '@moldea.ai/core', version: '7.0.2' },
      { name: '@moldea.ai/repository', version: '2.0.0' },
      { name: '@moldea.ai/repository-fs', version: '2.0.3' },
    ]);
    expect(JSON.stringify(result)).not.toContain('maturity');
    expect(JSON.stringify(result)).not.toContain('matrix');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.packages)).toBe(true);
    expect(Object.isFrozen(result.packages[0])).toBe(true);
  });
});
