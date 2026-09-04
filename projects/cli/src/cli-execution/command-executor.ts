import type { IProjectInspectionResult } from '@moldea.ai/core';

import { MOLDEA_CLI_COMMANDS } from '../command-line/index.js';
import type { IMoldeaCliCompositionResolver } from '../composition/index.js';
import type { IMoldeaCliCoreInspectionExecutor } from '../core-composition/index.js';
import {
  discoverGitWorkingTree,
  type IGitWorkingTreeDiscovery,
} from '../git-working-tree/index.js';
import { mapMoldeaCliOperationalError } from '../operational-error/index.js';
import {
  executeMoldeaCliProjectContent,
  parseMoldeaCliCanonicalContentPath,
  type IMoldeaCliProjectContentExecutor,
} from '../project-content/index.js';
import {
  executeMoldeaCliProjectScope,
  MOLDEA_MANIFEST_PATH,
  parseMoldeaCliScopePathBytes,
  type IMoldeaCliProjectScopeExecutor,
} from '../project-scope/index.js';
import { createMoldeaCliOwnedError } from '../presentation/index.js';
import {
  executeWorkingTreeSnapshot,
  type IWorkingTreeSnapshotExecutor,
} from '../working-tree-snapshot/index.js';

import { MOLDEA_CLI_EXIT_CODES } from './constants.js';
import {
  createMoldeaCliCompositionExecutionResult,
  createMoldeaCliContentExecutionResult,
  createMoldeaCliErrorResult,
  createMoldeaCliInspectExecutionResult,
  createMoldeaCliScopeExecutionResult,
  createMoldeaCliValidateExecutionResult,
} from './results.js';
import type { IMoldeaCliCommandExecutor, IMoldeaCliExecutionResult } from './types.js';

/** Loads adapter-backed Core inspection only for commands that need it. */
const executeLazyCoreInspection: IMoldeaCliCoreInspectionExecutor = async (input) => {
  const { executeMoldeaCliCoreInspection } = await import('../core-composition/index.js');

  return executeMoldeaCliCoreInspection(input);
};

type IMoldeaCliCompositionLoader = (
  input: Parameters<IMoldeaCliCompositionResolver>[0],
) => ReturnType<IMoldeaCliCompositionResolver> | Promise<ReturnType<IMoldeaCliCompositionResolver>>;

const loadInstalledComposition: IMoldeaCliCompositionLoader = async (input) => {
  const { resolveInstalledMoldeaCliComposition } = await import('../composition/index.js');

  return resolveInstalledMoldeaCliComposition(input);
};

/** Creates one operational error result without exposing caught failure details. */
const createOperationalErrorResult = (
  code: Parameters<typeof createMoldeaCliOwnedError>[0],
  input: Parameters<IMoldeaCliCommandExecutor>[0],
): IMoldeaCliExecutionResult =>
  createMoldeaCliErrorResult(
    createMoldeaCliOwnedError(code),
    input.invocation.command,
    input.packageMetadata.version,
    input.invocation.options.isJson,
    MOLDEA_CLI_EXIT_CODES.OperationalError,
  );

/**
 * Creates command dispatch with lazy adapter composition and bounded working-tree snapshots.
 * @param workingTreeDiscovery The Git working-tree discovery operation.
 * @param workingTreeSnapshotExecutor The complete working-tree snapshot operation.
 * @param coreInspectionExecutor The adapter-backed Core inspection operation.
 * @param compositionLoader The installed executable-integrity composition boundary.
 * @param projectScopeExecutor The adapter-free manifest scope operation.
 * @param projectContentExecutor The adapter-free canonical content operation.
 * @returns A command executor for the schema 3 CLI.
 */
export const createMoldeaCliCommandExecutor = (
  workingTreeDiscovery: IGitWorkingTreeDiscovery = discoverGitWorkingTree,
  workingTreeSnapshotExecutor: IWorkingTreeSnapshotExecutor = executeWorkingTreeSnapshot,
  coreInspectionExecutor: IMoldeaCliCoreInspectionExecutor = executeLazyCoreInspection,
  compositionLoader: IMoldeaCliCompositionLoader = loadInstalledComposition,
  projectScopeExecutor: IMoldeaCliProjectScopeExecutor = executeMoldeaCliProjectScope,
  projectContentExecutor: IMoldeaCliProjectContentExecutor = executeMoldeaCliProjectContent,
): IMoldeaCliCommandExecutor => {
  return async (input): Promise<IMoldeaCliExecutionResult> => {
    const command = input.invocation.command;
    const options = input.invocation.options;

    try {
      if (
        command === MOLDEA_CLI_COMMANDS.Composition ||
        command === MOLDEA_CLI_COMMANDS.Inspect ||
        command === MOLDEA_CLI_COMMANDS.Validate
      ) {
        const compositionResolution = await compositionLoader({
          packageMetadata: input.packageMetadata,
        });

        if (compositionResolution.kind === 'invalid') {
          return createOperationalErrorResult('COMPOSITION_STATE_INVALID', input);
        }

        if (command === MOLDEA_CLI_COMMANDS.Composition) {
          return createMoldeaCliCompositionExecutionResult(
            compositionResolution.result,
            input.packageMetadata.version,
            options.isJson,
          );
        }
      }

      let scopePaths: readonly string[] | null = null;
      let contentPath: ReturnType<typeof parseMoldeaCliCanonicalContentPath> | null = null;

      if (command === MOLDEA_CLI_COMMANDS.Scope) {
        if (options.pathsInput === 'path' && options.path !== null) {
          scopePaths = Object.freeze([options.path]);
        } else if (options.pathsInput === 'stdin' && input.stdin !== undefined) {
          if (input.stdin.byteLength > options.resourceLimits.maxTotalBytes) {
            return createOperationalErrorResult('RESOURCE_LIMIT_EXCEEDED', input);
          }

          scopePaths = parseMoldeaCliScopePathBytes(input.stdin, options.resourceLimits.maxEntries);
        } else {
          return createOperationalErrorResult('PATH_INPUT_INVALID', input);
        }
      }

      if (command === MOLDEA_CLI_COMMANDS.Content) {
        if (options.path === null) {
          return createOperationalErrorResult('CONTENT_PATH_INVALID', input);
        }

        contentPath = parseMoldeaCliCanonicalContentPath(options.path);
      }

      const discoveryResult = await workingTreeDiscovery({
        invocationDirectory: input.invocationDirectory,
        repositoryDirectory: options.repositoryDirectory,
        ...(input.signal === undefined ? {} : { signal: input.signal }),
      });

      if (discoveryResult.kind === 'failed') {
        return createOperationalErrorResult(discoveryResult.errorCode, input);
      }

      const resourceLimits = options.resourceLimits;
      const snapshotResult = await workingTreeSnapshotExecutor({
        operation: async (repository, signal) => {
          if (command === MOLDEA_CLI_COMMANDS.Scope && scopePaths !== null) {
            return projectScopeExecutor({
              paths: scopePaths,
              repository,
              resourceLimits,
              ...(signal === undefined ? {} : { signal }),
            });
          }

          if (command === MOLDEA_CLI_COMMANDS.Content && contentPath !== null) {
            return projectContentExecutor({
              path: contentPath,
              repository,
              resourceLimits,
              ...(signal === undefined ? {} : { signal }),
            });
          }

          return coreInspectionExecutor({
            repository,
            resourceLimits,
            ...(signal === undefined ? {} : { signal }),
          });
        },
        repositoryRoot: discoveryResult.repositoryRoot,
        resourceLimits,
        ...(command === MOLDEA_CLI_COMMANDS.Scope
          ? { selectionPaths: [MOLDEA_MANIFEST_PATH] }
          : contentPath === null
            ? {}
            : { selectionPaths: [contentPath] }),
        ...(input.signal === undefined ? {} : { signal: input.signal }),
      });

      if (snapshotResult.kind === 'failed') {
        return createOperationalErrorResult(snapshotResult.errorCode, input);
      }

      if (command === MOLDEA_CLI_COMMANDS.Validate) {
        return createMoldeaCliValidateExecutionResult(
          snapshotResult.result as IProjectInspectionResult,
          input.packageMetadata.version,
          options.isJson,
          options.cursor,
          options.maxOutputBytes,
        );
      }

      if (command === MOLDEA_CLI_COMMANDS.Inspect) {
        return createMoldeaCliInspectExecutionResult(
          snapshotResult.result as IProjectInspectionResult,
          input.packageMetadata.version,
          options.isJson,
          options.cursor,
          options.maxOutputBytes,
        );
      }

      if (command === MOLDEA_CLI_COMMANDS.Scope) {
        return createMoldeaCliScopeExecutionResult(
          snapshotResult.result as Awaited<ReturnType<IMoldeaCliProjectScopeExecutor>>,
          input.packageMetadata.version,
          options.isJson,
          options.cursor,
          options.maxOutputBytes,
        );
      }

      return createMoldeaCliContentExecutionResult(
        snapshotResult.result as Awaited<ReturnType<IMoldeaCliProjectContentExecutor>>,
        input.packageMetadata.version,
        options.isJson,
        options.cursor,
        options.maxOutputBytes,
      );
    } catch (error) {
      return createMoldeaCliErrorResult(
        mapMoldeaCliOperationalError(error),
        command,
        input.packageMetadata.version,
        options.isJson,
        MOLDEA_CLI_EXIT_CODES.OperationalError,
      );
    }
  };
};

// default private command dispatcher used by the executable runner
export const executeMoldeaCliCommand = createMoldeaCliCommandExecutor();
