// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';

import type {
  IContentDigest,
  IProjectInspectionPageResult,
  IProjectValidationResult,
} from '@moldea.ai/core';
import { parseRepositoryPath, type IRepositoryReader } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import type { IMoldeaCliCommand } from '../command-line/index.js';
import type { IMoldeaCliCompositionResolver } from '../composition/index.js';
import type { IMoldeaCliCoreInspectionExecutor } from '../core-composition/index.js';
import type { IGitWorkingTreeDiscovery } from '../git-working-tree/index.js';
import type { IMoldeaCliProjectContentExecutor } from '../project-content/index.js';
import {
  MOLDEA_MANIFEST_PATH,
  type IMoldeaCliProjectScopeExecutor,
} from '../project-scope/index.js';
import type {
  IWorkingTreeSnapshotExecutionInput,
  IWorkingTreeSnapshotExecutionResult,
  IWorkingTreeSnapshotExecutor,
} from '../working-tree-snapshot/index.js';

import { createMoldeaCliCommandExecutor } from './command-executor.js';
import type { IMoldeaCliCommandExecutionInput } from './types.js';

const SOURCE = Object.freeze({ id: 'memory:command', sourceKind: 'memory' });
const PROJECT_SUMMARY = Object.freeze({
  counts: Object.freeze({
    agents: 0,
    context: 0,
    decisions: 0,
    mirrors: 0,
    runtimes: 0,
    unresolved: 0,
  }),
  manifestDigest: `sha256:${'1'.repeat(64)}` as IContentDigest,
  manifestPath: parseRepositoryPath('/moldea/moldea.yaml'),
  projectDigest: `sha256:${'2'.repeat(64)}` as IContentDigest,
  projectPath: parseRepositoryPath('/moldea/project.md'),
});
const VALIDATION_RESULT = Object.freeze({
  diagnostics: Object.freeze([]),
  evidence: Object.freeze([]),
  formatVersion: 1,
  source: SOURCE,
  summary: PROJECT_SUMMARY,
  valid: true,
}) satisfies IProjectValidationResult;

const createInspectionResult = (nextCursor: string | null): IProjectInspectionPageResult =>
  Object.freeze({
    counts: Object.freeze({
      ...PROJECT_SUMMARY.counts,
      diagnostics: 0,
      evidence: 0,
      metadata: 2,
    }),
    formatVersion: 1,
    inspectionDigest: `sha256:${'3'.repeat(64)}`,
    page: Object.freeze({
      isComplete: nextCursor === null,
      nextCursor,
      records: Object.freeze([
        Object.freeze({
          item: Object.freeze({
            kind: 'metadata' as const,
            metadata: Object.freeze({
              agentId: null,
              byteLength: 11,
              canonicalDigest: null,
              decisionId: null,
              digest: PROJECT_SUMMARY.manifestDigest,
              kind: 'manifest' as const,
              path: PROJECT_SUMMARY.manifestPath,
              scalarLength: 11,
            }),
          }),
          nextCursor,
        }),
      ]),
      totalItems: 2,
    }),
    source: SOURCE,
    summary: PROJECT_SUMMARY,
    valid: true,
    view: 'all',
  });

const VALID_COMPOSITION = Object.freeze({
  kind: 'valid' as const,
  result: Object.freeze({
    adapters: Object.freeze([]),
    minimumGitVersion: '2.30.0',
    packages: Object.freeze([]),
    repositoryFormatVersions: Object.freeze([1]),
    supportedNodeRange: '>=22.11.0',
  }),
});

/** Creates one normalized command input with optional command-specific overrides. */
const createCommandInput = (
  command: IMoldeaCliCommand,
  options: Partial<IMoldeaCliCommandExecutionInput['invocation']['options']> = {},
): IMoldeaCliCommandExecutionInput => ({
  invocationDirectory: '/workspace',
  invocation: {
    command,
    options: {
      cursor: null,
      isColorDisabled: false,
      isJson: true,
      maxOutputBytes: 65_536,
      path: null,
      pathsInput: 'none',
      repositoryDirectory: null,
      resourceLimits: {
        maxDiagnostics: 1024,
        maxEntries: 4096,
        maxEvidence: 1024,
        maxFileBytes: 8_388_608,
        maxManifestBytes: 2_097_152,
        maxTotalBytes: 134_217_728,
      },
      ...options,
    },
  },
  packageMetadata: {
    dependencies: Object.freeze({}),
    installedPackageVersions: Object.freeze({}),
    supportedNodeRange: '>=22.11.0',
    version: '7.0.0',
  },
});

interface ITestSnapshotExecution {
  readonly executor: IWorkingTreeSnapshotExecutor;
  readonly reader: IRepositoryReader;
  selectionPaths: readonly string[] | null;
}

/** Creates a snapshot executor that records selection and completes its operation. */
const createCompletedSnapshotExecutor = (): ITestSnapshotExecution => {
  const reader = createMemoryRepositoryReader([]);
  const execution: ITestSnapshotExecution = {
    executor: async <TResult>(
      input: IWorkingTreeSnapshotExecutionInput<TResult>,
    ): Promise<IWorkingTreeSnapshotExecutionResult<TResult>> => {
      execution.selectionPaths = input.selectionPaths ?? null;
      const result = await input.operation(reader, input.signal);

      return Object.freeze({ kind: 'completed', result });
    },
    reader,
    selectionPaths: null,
  };

  return execution;
};

const createDiscovery = (): IGitWorkingTreeDiscovery =>
  vi
    .fn<IGitWorkingTreeDiscovery>()
    .mockResolvedValue(Object.freeze({ kind: 'discovered', repositoryRoot: '/workspace' }));

const createCompositionResolver = (): IMoldeaCliCompositionResolver =>
  vi.fn<IMoldeaCliCompositionResolver>().mockReturnValue(VALID_COMPOSITION);

describe('createMoldeaCliCommandExecutor', () => {
  test('validates through a content-free Core result', async () => {
    const snapshot = createCompletedSnapshotExecutor();
    const coreInspection = vi
      .fn<IMoldeaCliCoreInspectionExecutor>()
      .mockResolvedValue(VALIDATION_RESULT);
    const executeCommand = createMoldeaCliCommandExecutor(
      createDiscovery(),
      snapshot.executor,
      coreInspection,
      createCompositionResolver(),
    );

    const result = await executeCommand(createCommandInput('validate'));
    const envelope = JSON.parse(result.stdout) as Record<string, unknown>;

    expect(result.exitCode).toBe(0);
    expect(envelope).toMatchObject({ command: 'validate', schemaVersion: 4, status: 'valid' });
    expect(result.stdout).not.toContain('content');
    expect(coreInspection).toHaveBeenCalledWith({
      command: 'validate',
      repository: snapshot.reader,
      resourceLimits: createCommandInput('validate').invocation.options.resourceLimits,
    });
  });

  test('continues inspect from the Core cursor carried by the CLI cursor', async () => {
    const snapshot = createCompletedSnapshotExecutor();
    const coreCursor = 'core3:all:1:memory%3Acommand';
    const coreInspection = vi
      .fn<IMoldeaCliCoreInspectionExecutor>()
      .mockResolvedValueOnce(createInspectionResult(coreCursor))
      .mockResolvedValueOnce(createInspectionResult(null));
    const executeCommand = createMoldeaCliCommandExecutor(
      createDiscovery(),
      snapshot.executor,
      coreInspection,
      createCompositionResolver(),
    );
    const first = await executeCommand(createCommandInput('inspect'));
    const firstEnvelope = JSON.parse(first.stdout) as {
      readonly result: { readonly page: { readonly cursor: string } };
    };

    await executeCommand(
      createCommandInput('inspect', { cursor: firstEnvelope.result.page.cursor }),
    );

    expect(coreInspection).toHaveBeenNthCalledWith(2, {
      command: 'inspect',
      cursor: coreCursor,
      repository: snapshot.reader,
      resourceLimits: createCommandInput('inspect').invocation.options.resourceLimits,
    });
  });

  test('runs scope against only the selected manifest without loading adapters', async () => {
    const snapshot = createCompletedSnapshotExecutor();
    const coreInspection = vi.fn<IMoldeaCliCoreInspectionExecutor>();
    const projectScope = vi.fn<IMoldeaCliProjectScopeExecutor>().mockResolvedValue({
      manifestContent: 'version: 1\n',
      scope: {
        counts: { declarations: 0, inputPaths: 1, matchedOwners: 0, matchedPaths: 0, matches: 0 },
        diagnostics: [],
        inputDigest: `sha256:${'3'.repeat(64)}` as IContentDigest,
        manifestDigest: `sha256:${'4'.repeat(64)}` as IContentDigest,
        matches: [],
        relevant: false,
        valid: true,
      },
    });
    const executeCommand = createMoldeaCliCommandExecutor(
      createDiscovery(),
      snapshot.executor,
      coreInspection,
      createCompositionResolver(),
      projectScope,
    );
    const result = await executeCommand(
      createCommandInput('scope', { path: '/unrelated.md', pathsInput: 'path' }),
    );

    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'scope',
      result: { relevant: false, valid: true },
      schemaVersion: 4,
    });
    expect(snapshot.selectionPaths).toStrictEqual([MOLDEA_MANIFEST_PATH]);
    expect(coreInspection).not.toHaveBeenCalled();
  });

  test('runs content through a bounded selected range without loading adapters', async () => {
    const snapshot = createCompletedSnapshotExecutor();
    const coreInspection = vi.fn<IMoldeaCliCoreInspectionExecutor>();
    const projectContent = vi.fn<IMoldeaCliProjectContentExecutor>().mockResolvedValue({
      byteEnd: 10,
      byteStart: 0,
      content: '# Project\n',
      contentIdentity: `sha256:${'5'.repeat(64)}`,
      isComplete: true,
      nextOffset: null,
      path: parseRepositoryPath('/moldea/project.md'),
      source: SOURCE,
      totalBytes: 10,
    });
    const executeCommand = createMoldeaCliCommandExecutor(
      createDiscovery(),
      snapshot.executor,
      coreInspection,
      createCompositionResolver(),
      vi.fn<IMoldeaCliProjectScopeExecutor>(),
      projectContent,
    );
    const result = await executeCommand(
      createCommandInput('content', { path: '/moldea/project.md', pathsInput: 'path' }),
    );

    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'content',
      result: {
        asset: { path: '/moldea/project.md', totalBytes: 10 },
        chunk: { byteEnd: 10, byteStart: 0, content: '# Project\n' },
      },
      schemaVersion: 4,
    });
    expect(snapshot.selectionPaths).toStrictEqual([parseRepositoryPath('/moldea/project.md')]);
    expect(projectContent).toHaveBeenCalledWith(
      expect.objectContaining({ maxBytes: 32_768, offset: 0, path: '/moldea/project.md' }),
    );
    expect(coreInspection).not.toHaveBeenCalled();
  });

  test('returns a bounded safe error when working-tree discovery fails', async () => {
    const discovery = vi
      .fn<IGitWorkingTreeDiscovery>()
      .mockResolvedValue(Object.freeze({ errorCode: 'GIT_NOT_FOUND', kind: 'failed' }));
    const executeCommand = createMoldeaCliCommandExecutor(
      discovery,
      createCompletedSnapshotExecutor().executor,
      vi.fn<IMoldeaCliCoreInspectionExecutor>(),
      createCompositionResolver(),
    );

    const result = await executeCommand(createCommandInput('inspect'));

    expect(result.exitCode).toBe(3);
    expect(Buffer.byteLength(result.stdout, 'utf8')).toBeLessThan(4096);
    expect(JSON.parse(result.stdout)).toMatchObject({
      error: { code: 'GIT_NOT_FOUND' },
      result: null,
      schemaVersion: 4,
      status: 'error',
    });
  });
});
