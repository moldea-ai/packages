import {
  createInspectionSessionFactory,
  getSourceRetainedBytes,
} from '@moldea.ai/adapter-static-analysis';
import { readRuntimeAdapterFile, type IRuntimeAdapterContext } from '@moldea.ai/core/adapter';

import type { ILangChainInspectionSession } from '../contracts/index.js';
import { discoverLangChainPackages } from '../package-discovery/index.js';
import { analyzeLangChainSource } from '../source-analysis/index.js';

/** Creates one operation-local LangChain inspection session. */
export const createLangChainInspectionSession: (
  context: IRuntimeAdapterContext,
) => ILangChainInspectionSession = createInspectionSessionFactory(
  (context: IRuntimeAdapterContext) => ({
    owner: context.repository,
    ...(context.agent.declaration.bindings?.runtimeAgent === undefined
      ? {}
      : {
          activeSourcePath: context.agent.declaration.bindings.runtimeAgent.path,
        }),
    analyzeSource: analyzeLangChainSource,
    getSourceRetainedBytes,
    discoverPackage: (path, signal) => discoverLangChainPackages(context.repository, path, signal),
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
