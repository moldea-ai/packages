// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';

import {
  DEFAULT_CORE_RESOURCE_LIMITS,
  RECOGNIZED_RUNTIME_IDS,
  SUPPORTED_REPOSITORY_FORMAT_VERSIONS,
} from '../constants/index.js';
import { CoreConfigurationException, CoreOperationException } from '../exceptions/index.js';
import { createMemoryRepositoryReader } from '../repository.test-fixtures.js';

import { createCore } from './index.js';

describe('Core constants and construction', () => {
  test('exports exact deeply immutable version and resource-limit constants', () => {
    expect(RECOGNIZED_RUNTIME_IDS).toStrictEqual([
      'amazon-bedrock',
      'anthropic',
      'cerebras',
      'claude-agent-sdk',
      'cloudflare-agents',
      'cohere',
      'convex-agent',
      'cursor-sdk',
      'custom',
      'deep-agents',
      'eve',
      'genkit',
      'github-copilot-sdk',
      'google-adk',
      'google-genai',
      'groq',
      'hugging-face',
      'ibm-watsonx-ai',
      'langchain',
      'langgraph',
      'livekit-agents',
      'mastra',
      'microsoft-foundry',
      'mistral',
      'node-llama-cpp',
      'ollama',
      'openai',
      'openai-agents-sdk',
      'openai-codex',
      'opencode-sdk',
      'openrouter',
      'pi-agent',
      'strands-agents',
      'tanstack-ai',
      'vercel-ai-sdk',
      'voltagent',
    ]);
    expect(SUPPORTED_REPOSITORY_FORMAT_VERSIONS).toStrictEqual([1]);
    expect(DEFAULT_CORE_RESOURCE_LIMITS).toStrictEqual({
      maxDiagnostics: 10_000,
      maxEntries: 100_000,
      maxCoverage: 10_000,
      maxAcceptedWarnings: 256,
      maxFileBytes: 8_388_608,
      maxManifestBytes: 2_097_152,
      maxRetainedBytes: 536_870_912,
      maxTotalBytesRead: 134_217_728,
    });
    expect(Object.isFrozen(RECOGNIZED_RUNTIME_IDS)).toBe(true);
    expect(Object.isFrozen(SUPPORTED_REPOSITORY_FORMAT_VERSIONS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_CORE_RESOURCE_LIMITS)).toBe(true);
  });

  test('creates one frozen Core instance with only the implemented method surface', () => {
    const core = createCore();

    expect(Object.isFrozen(core)).toBe(true);
    expect(Object.keys(core).sort()).toStrictEqual([
      'calculateContentDigest',
      'createProjectInspection',
      'matchManifestScope',
      'normalizeText',
      'parseDecision',
      'parseManifest',
      'readCanonicalContentPage',
      'validateProject',
    ]);
    expect(typeof core.calculateContentDigest).toBe('function');
    expect(typeof core.validateProject).toBe('function');
    expect(typeof core.matchManifestScope).toBe('function');
    expect(typeof core.normalizeText).toBe('function');
    expect(typeof core.parseDecision).toBe('function');
    expect(typeof core.parseManifest).toBe('function');
  });

  test('copies resource limits without freezing caller-owned configuration', () => {
    const limits = { maxFileBytes: 1 };
    const options = { limits };
    const core = createCore(options);

    limits.maxFileBytes = 100;

    expect(Object.isFrozen(options)).toBe(false);
    expect(Object.isFrozen(limits)).toBe(false);
    expect(() =>
      core.normalizeText({
        content: 'ab',
        path: parseRepositoryPath('/two-bytes.txt'),
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'RESOURCE_LIMIT_EXCEEDED',
        limit: 'maxFileBytes',
        operation: 'normalize-text',
      }),
    );
  });

  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])(
    'rejects invalid resource limit %o',
    (maxFileBytes) => {
      expect(() => createCore({ limits: { maxFileBytes } })).toThrowError(
        expect.objectContaining({
          code: 'INVALID_RESOURCE_LIMIT',
          operation: 'create-core',
        }),
      );
    },
  );

  test('rejects unknown resource-limit properties', () => {
    expect(() => createCore({ limits: { maxUnknown: 1 } as never })).toThrowError(
      CoreConfigurationException,
    );
  });

  test('uses typed operation failures for invalid public arguments', async () => {
    const core = createCore();

    expect(() => core.normalizeText(null as never)).toThrowError(
      expect.objectContaining({
        code: 'INVALID_ARGUMENT',
        operation: 'normalize-text',
        retryable: false,
      }),
    );
    await expect(core.calculateContentDigest({ content: 1 } as never)).rejects.toBeInstanceOf(
      CoreOperationException,
    );
    await expect(core.parseManifest({ content: 1 } as never)).rejects.toBeInstanceOf(
      CoreOperationException,
    );
    await expect(core.parseDecision({ content: 1 } as never)).rejects.toBeInstanceOf(
      CoreOperationException,
    );
    await expect(core.matchManifestScope(null as never)).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      operation: 'match-manifest-scope',
      retryable: false,
    });
    await expect(core.validateProject(null as never)).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      operation: 'validate-project',
      retryable: false,
    });
    await expect(
      core.validateProject({ repository: { getEntry: null } } as never),
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      operation: 'validate-project',
    });
    await expect(
      core.validateProject({
        repository: createMemoryRepositoryReader([]),
        signal: null,
      } as never),
    ).rejects.toBeInstanceOf(CoreOperationException);
  });

  test('snapshots the repository input property before inspection', async () => {
    const repository = createMemoryRepositoryReader([]);
    let repositoryReads = 0;
    const input = Object.defineProperty({}, 'repository', {
      enumerable: true,
      get: () => {
        repositoryReads += 1;
        return repositoryReads === 1 ? repository : null;
      },
    });
    const result = await createCore().validateProject(input as never);

    expect(repositoryReads).toBe(1);
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'MOLDEA_MANIFEST_MISSING' }),
    );
  });
});
