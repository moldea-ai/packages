import {
  createInspectionSessionFactory,
  getSourceRetainedBytes,
} from '@moldea.ai/adapter-static-analysis';
import { readRuntimeAdapterFile, type IRuntimeAdapterContext } from '@moldea.ai/core/adapter';

import type { IVercelAiSdkInspectionSession } from '../contracts/index.js';
import { discoverVercelAiSdkPackage } from '../package-discovery/index.js';
import { analyzeVercelAiSdkSource } from '../source-analysis/index.js';

/** Creates one operation-local Vercel AI SDK inspection session. */
export const createVercelAiSdkInspectionSession: (
  context: IRuntimeAdapterContext,
) => IVercelAiSdkInspectionSession = createInspectionSessionFactory(
  (context: IRuntimeAdapterContext) => ({
    owner: context.repository,
    ...(context.agent.declaration.bindings?.runtimeAgent === undefined
      ? {}
      : {
          activeSourcePath: context.agent.declaration.bindings.runtimeAgent.path,
        }),
    analyzeSource: analyzeVercelAiSdkSource,
    getSourceRetainedBytes,
    discoverPackage: (path, signal) => discoverVercelAiSdkPackage(context.repository, path, signal),
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
