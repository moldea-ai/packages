import {
  createInspectionSessionFactory,
  getSourceRetainedBytes,
} from '@moldea.ai/adapter-static-analysis';
import { readRuntimeAdapterFile, type IRuntimeAdapterContext } from '@moldea.ai/core/adapter';

import type { IClaudeAgentSdkInspectionSession } from '../contracts/index.js';
import { discoverClaudeAgentSdkPackage } from '../package-discovery/index.js';
import { analyzeClaudeAgentSdkSource } from '../source-analysis/index.js';

/** Creates one operation-local Claude Agent SDK inspection session. */
export const createClaudeAgentSdkInspectionSession: (
  context: IRuntimeAdapterContext,
) => IClaudeAgentSdkInspectionSession = createInspectionSessionFactory(
  (context: IRuntimeAdapterContext) => ({
    owner: context.repository,
    ...(context.agent.declaration.bindings?.runtimeAgent === undefined
      ? {}
      : {
          activeSourcePath: context.agent.declaration.bindings.runtimeAgent.path,
        }),
    analyzeSource: analyzeClaudeAgentSdkSource,
    getSourceRetainedBytes,
    discoverPackage: (path, signal) =>
      discoverClaudeAgentSdkPackage(context.repository, path, signal),
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
