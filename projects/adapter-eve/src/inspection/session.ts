import {
  createInspectionSessionFactory,
  getSourceRetainedBytes,
  createBoundedInspectionCache,
} from '@moldea.ai/adapter-static-analysis';
import {
  iterateRuntimeAdapterEntries,
  readRuntimeAdapterFile,
  type IRuntimeAdapterContext,
} from '@moldea.ai/core/adapter';
import type { IRepositoryEntry, IRepositoryPath } from '@moldea.ai/repository';

import type { IEveAgentRootIndex, IEveInspectionSession } from '../contracts/index.js';
import { discoverEvePackage } from '../package-discovery/index.js';
import { createEveAgentRootIndex } from '../repository-discovery/index.js';
import { analyzeEveSource } from '../source-analysis/index.js';

const createSourceSession = createInspectionSessionFactory((context: IRuntimeAdapterContext) => ({
  owner: context.repository,
  ...(context.agent.declaration.bindings?.runtimeAgent === undefined
    ? {}
    : {
        activeSourcePath: context.agent.declaration.bindings.runtimeAgent.path,
      }),
  analyzeSource: analyzeEveSource,
  getSourceRetainedBytes,
  discoverPackage: (path, signal) => discoverEvePackage(context.repository, path, signal),
  getEntry: (path, signal) =>
    context.repository.getEntry(path, signal === undefined ? undefined : { signal }),
  readFile: (path, signal) =>
    readRuntimeAdapterFile(context.repository, path, signal === undefined ? undefined : { signal }),
  ...(context.signal === undefined ? {} : { signal: context.signal }),
}));
const createRootCache = (runLoad: ReturnType<typeof createSourceSession>['runLoad']) =>
  createBoundedInspectionCache<IEveAgentRootIndex>(
    { entries: 16, retainedBytes: 16 * 1024 * 1024 },
    runLoad,
  );
const rootOwners = new WeakMap<object, ReturnType<typeof createRootCache>>();

/** Creates one operation-local Eve inspection session with bounded source and listing caches. */
export const createEveInspectionSession = (
  context: IRuntimeAdapterContext,
): IEveInspectionSession => {
  const base = createSourceSession(context);
  let rootCache = rootOwners.get(context.repository);
  if (rootCache === undefined) {
    rootCache = createRootCache((load) => base.runLoad(load));
    rootOwners.set(context.repository, rootCache);
  }
  const cache = rootCache;

  const indexAgentRoot = (path: IRepositoryPath): Promise<IEveAgentRootIndex> => {
    return cache.get(
      path,
      async () => {
        const entries: IRepositoryEntry[] = [];

        for await (const entry of iterateRuntimeAdapterEntries(context.repository, {
          prefix: path,
          ...(context.signal === undefined ? {} : { signal: context.signal }),
        })) {
          context.signal?.throwIfAborted();
          entries.push(entry);
        }

        return {
          result: createEveAgentRootIndex(path, entries),
          retainedBytes: 65536 + entries.length * 1024,
        };
      },
      context.signal,
    );
  };

  return Object.freeze({
    ...base,
    indexAgentRoot,
    reader: context.repository,
  });
};
