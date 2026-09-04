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
    expect(result.adapters).toHaveLength(11);
    expect(result.adapters[0]).toStrictEqual({
      id: 'anthropic',
      repositoryFormatVersions: [1],
    });
    expect(result.adapters.find(({ id }) => id === 'custom')).toStrictEqual({
      id: 'custom',
      repositoryFormatVersions: [1],
    });
    expect(result.packages).toContainEqual({
      name: '@moldea.ai/adapter-openai',
      version: '3.0.0',
    });
    expect(JSON.stringify(result)).not.toContain('maturity');
    expect(JSON.stringify(result)).not.toContain('matrix');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.adapters)).toBe(true);
    expect(Object.isFrozen(result.adapters[0])).toBe(true);
  });
});
