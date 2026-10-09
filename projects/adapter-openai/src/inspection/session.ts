import {
  createInspectionSessionFactory,
  getSourceRetainedBytes,
} from '@moldea.ai/adapter-static-analysis';
import { readRuntimeAdapterFile, type IRuntimeAdapterContext } from '@moldea.ai/core/adapter';

import type { IOpenAiInspectionSession } from '../contracts/index.js';
import { discoverOpenAiPackage } from '../package-discovery/index.js';
import { analyzeOpenAiSource } from '../source-analysis/index.js';

/**
 * Creates one operation-local OpenAI inspection session and its deterministic caches.
 * @param context The Core-owned adapter context.
 * @returns The source and package analysis session.
 */
export const createOpenAiInspectionSession: (
  context: IRuntimeAdapterContext,
) => IOpenAiInspectionSession = createInspectionSessionFactory(
  (context: IRuntimeAdapterContext) => ({
    owner: context.repository,
    ...(context.agent.declaration.bindings?.runtimeAgent === undefined
      ? {}
      : {
          activeSourcePath: context.agent.declaration.bindings.runtimeAgent.path,
        }),
    analyzeSource: analyzeOpenAiSource,
    getSourceRetainedBytes,
    discoverPackage: (path, signal) => discoverOpenAiPackage(context.repository, path, signal),
    getEntry: (path, signal) =>
      context.repository.getEntry(path, signal === undefined ? undefined : { signal }),
    readFile: (path, signal) =>
      readRuntimeAdapterFile(
        context.repository,
        path,
        signal === undefined ? undefined : { signal },
      ),
    ...(context.signal === undefined ? {} : { signal: context.signal }),
  }),
);
