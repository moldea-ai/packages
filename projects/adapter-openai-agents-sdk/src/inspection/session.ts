import { createInspectionSession } from '@moldea.ai/adapter-static-analysis';
import { readRuntimeAdapterFile, type IRuntimeAdapterContext } from '@moldea.ai/core/adapter';

import type { IOpenAiAgentsSdkInspectionSession } from '../contracts/index.js';
import { discoverOpenAiAgentsSdkPackage } from '../package-discovery/index.js';
import { analyzeOpenAiAgentsSdkSource } from '../source-analysis/index.js';

/** Creates one operation-local OpenAI Agents SDK inspection session. */
export const createOpenAiAgentsSdkInspectionSession = (
  context: IRuntimeAdapterContext,
): IOpenAiAgentsSdkInspectionSession =>
  createInspectionSession({
    analyzeSource: analyzeOpenAiAgentsSdkSource,
    discoverPackage: (path, signal) =>
      discoverOpenAiAgentsSdkPackage(context.repository, path, signal),
    getEntry: (path, signal) =>
      context.repository.getEntry(path, signal === undefined ? undefined : { signal }),
    readFile: (path, signal) =>
      readRuntimeAdapterFile(
        context.repository,
        path,
        signal === undefined ? undefined : { signal },
      ),
    ...(context.signal === undefined ? {} : { signal: context.signal }),
  });
