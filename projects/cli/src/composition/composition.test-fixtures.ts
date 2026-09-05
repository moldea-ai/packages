import type { IRuntimeAdapter } from '@moldea.ai/core/adapter';

import type { IMoldeaCliPackageMetadata } from '../package-metadata/index.js';

import { MOLDEA_CLI_FIRST_CLASS_PACKAGE_RANGES } from './constants.js';
import type { IMoldeaCliCompositionStateInput } from './types.js';

const PACKAGE_VERSIONS = {
  '@moldea.ai/adapter-anthropic': '3.0.1',
  '@moldea.ai/adapter-claude-agent-sdk': '2.0.1',
  '@moldea.ai/adapter-cloudflare-agents': '2.0.1',
  '@moldea.ai/adapter-eve': '2.0.1',
  '@moldea.ai/adapter-google-genai': '2.0.1',
  '@moldea.ai/adapter-langchain': '2.0.1',
  '@moldea.ai/adapter-langgraph': '2.0.1',
  '@moldea.ai/adapter-openai': '3.0.1',
  '@moldea.ai/adapter-openai-agents-sdk': '2.0.1',
  '@moldea.ai/adapter-vercel-ai-sdk': '2.0.1',
  '@moldea.ai/core': '3.0.1',
  '@moldea.ai/repository': '2.0.0',
  '@moldea.ai/repository-fs': '2.0.1',
} as const;

// exact installed package metadata used by composition tests
export const INSTALLED_PACKAGE_METADATA: IMoldeaCliPackageMetadata = Object.freeze({
  dependencies: Object.freeze(
    Object.fromEntries(
      Object.keys(PACKAGE_VERSIONS).map((name) => [
        name,
        `workspace:${MOLDEA_CLI_FIRST_CLASS_PACKAGE_RANGES[name as keyof typeof MOLDEA_CLI_FIRST_CLASS_PACKAGE_RANGES]}`,
      ]),
    ),
  ),
  installedPackageVersions: Object.freeze({ ...PACKAGE_VERSIONS }),
  supportedNodeRange: '>=22.11.0',
  version: '7.0.1',
});

/** Creates one minimal runtime adapter for composition tests. */
export const createTestRuntimeAdapter = (
  id: string,
  supportedRepositoryFormatVersions: readonly 1[] = [1],
): IRuntimeAdapter => ({
  id,
  inspect: () => Promise.resolve(Object.freeze({ diagnostics: [], evidence: [] })),
  supportedRepositoryFormatVersions,
});

/** Creates the exact valid current runtime composition state. */
export const createTestCompositionState = (): IMoldeaCliCompositionStateInput => ({
  activeAdapters: [
    createTestRuntimeAdapter('anthropic'),
    createTestRuntimeAdapter('claude-agent-sdk'),
    createTestRuntimeAdapter('cloudflare-agents'),
    createTestRuntimeAdapter('eve'),
    createTestRuntimeAdapter('google-genai'),
    createTestRuntimeAdapter('langchain'),
    createTestRuntimeAdapter('langgraph'),
    createTestRuntimeAdapter('openai'),
    createTestRuntimeAdapter('openai-agents-sdk'),
    createTestRuntimeAdapter('vercel-ai-sdk'),
  ],
  coreSupportedRepositoryFormatVersions: [1],
  minimumGitVersion: '2.30.0',
  outputSchemaVersion: 4,
  packageMetadata: INSTALLED_PACKAGE_METADATA,
});
