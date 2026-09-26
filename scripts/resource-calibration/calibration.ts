import { Session } from 'node:inspector';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

import type { IRuntimeAdapter } from '../../projects/core/src/adapter/index.ts';
import type { createCore } from '../../projects/core/src/index.ts';
import type { IRepositoryReader } from '../../projects/repository/src/contracts.ts';
import type { createMemoryRepositoryReader } from '../../projects/repository/src/memory.ts';

import { CALIBRATION_WORKLOADS, createCalibrationEntries } from './fixtures.ts';

interface IReaderMetrics {
  bytesRead: number;
  entryLookups: number;
  listingPages: number;
  readPages: number;
  snapshotAccesses: number;
  snapshotAttempts: number;
}

interface ICalibrationSample extends IReaderMetrics {
  cpuMilliseconds: number;
  elapsedMilliseconds: number;
  handoffRegistrations: number;
  inspectionPages: number;
  outputBytes: number;
  parserInvocations: number | null;
  peakRssBytes: number;
  records: number;
}

interface ICalibrationResult {
  workload: string;
  samples: readonly ICalibrationSample[];
}

const encoder = new TextEncoder();

const createMeasuredReader = (
  reader: IRepositoryReader,
  metrics: IReaderMetrics,
): IRepositoryReader => ({
  get snapshot() {
    metrics.snapshotAccesses += 1;
    return reader.snapshot;
  },
  compare: (candidate, options) => reader.compare(candidate, options),
  getEntry: async (filePath, options) => {
    metrics.entryLookups += 1;
    return reader.getEntry(filePath, options);
  },
  listEntriesPage: async (options) => {
    metrics.listingPages += 1;
    return reader.listEntriesPage(options);
  },
  readFilePage: async (filePath, options) => {
    metrics.readPages += 1;
    const page = await reader.readFilePage(filePath, options);
    metrics.bytesRead += page.bytes.byteLength;
    return page;
  },
});

const postInspector = <T>(session: Session, method: string, parameters?: object): Promise<T> =>
  new Promise((resolve, reject) => {
    session.post(method, parameters, (error, result) => {
      if (error) reject(error);
      else resolve(result as T);
    });
  });

const countSourceParses = (coverage: {
  result: readonly {
    url: string;
    functions: readonly { functionName: string; ranges: readonly { count: number }[] }[];
  }[];
}): number =>
  Math.max(
    0,
    ...coverage.result
      .filter((script) => /[/\\]typescript[/\\]lib[/\\]typescript\.js$/u.test(script.url))
      .flatMap((script) => script.functions)
      .filter((functionCoverage) => functionCoverage.functionName === 'createSourceFile')
      .map((functionCoverage) => functionCoverage.ranges[0]?.count ?? 0),
  );

const measure = async (
  workload: (typeof CALIBRATION_WORKLOADS)[number],
  core: { createCore: typeof createCore },
  memory: { createMemoryRepositoryReader: typeof createMemoryRepositoryReader },
  adapter: IRuntimeAdapter,
): Promise<ICalibrationSample> => {
  const metrics: IReaderMetrics = {
    bytesRead: 0,
    entryLookups: 0,
    listingPages: 0,
    readPages: 0,
    snapshotAccesses: 0,
    snapshotAttempts: 0,
  };
  const repository = createMeasuredReader(
    memory.createMemoryRepositoryReader(createCalibrationEntries(workload)),
    metrics,
  );
  const inspector = new Session();
  inspector.connect();
  await postInspector(inspector, 'Profiler.enable');
  await postInspector(inspector, 'Profiler.startPreciseCoverage', {
    callCount: true,
    detailed: true,
  });

  let peakRssBytes = process.memoryUsage().rss;
  const memorySampler = setInterval(() => {
    peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
  }, 5);
  const startCpu = process.cpuUsage();
  const startTime = performance.now();

  try {
    const inspectionCore = core.createCore({ adapters: [adapter] });
    metrics.snapshotAttempts += 1;
    const inspection = await inspectionCore.createProjectInspection({
      // the built Core declarations and source-only calibration reader have separate path brands
      repository: repository as unknown as Parameters<
        typeof inspectionCore.createProjectInspection
      >[0]['repository'],
    });
    let cursor: string | undefined;
    let inspectionPages = 0;
    let outputBytes = 0;
    let records = 0;
    let handoffRegistrations = 0;

    do {
      const result = inspection.readPage({
        ...(cursor === undefined ? {} : { cursor }),
        maxItems: 16,
        view: 'all',
      });
      inspectionPages += 1;
      records += result.page.records.length;
      handoffRegistrations += result.page.records.filter(
        ({ item }) => item.kind === 'evidence' && item.evidence.kind === 'handoff-registration',
      ).length;
      outputBytes += encoder.encode(JSON.stringify(result)).byteLength;
      cursor = result.page.nextCursor ?? undefined;
    } while (cursor !== undefined);

    const elapsedMilliseconds = performance.now() - startTime;
    const cpu = process.cpuUsage(startCpu);
    peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
    const coverage = await postInspector<Parameters<typeof countSourceParses>[0]>(
      inspector,
      'Profiler.takePreciseCoverage',
    );

    return {
      ...metrics,
      cpuMilliseconds: (cpu.user + cpu.system) / 1_000,
      elapsedMilliseconds,
      handoffRegistrations,
      inspectionPages,
      outputBytes,
      parserInvocations: countSourceParses(coverage),
      peakRssBytes,
      records,
    };
  } finally {
    clearInterval(memorySampler);
    await postInspector(inspector, 'Profiler.stopPreciseCoverage');
    inspector.disconnect();
  }
};

/** Measures complete, bounded inspection workflows against built package artifacts. */
export const runCalibration = async (
  packageRoot: string,
): Promise<readonly ICalibrationResult[]> => {
  const importBuilt = async <T>(relativePath: string): Promise<T> =>
    (await import(pathToFileURL(path.join(packageRoot, relativePath)).href)) as T;
  const [core, memory, anthropic, eve] = await Promise.all([
    importBuilt<{ createCore: typeof createCore }>('projects/core/dist/index.js'),
    importBuilt<{ createMemoryRepositoryReader: typeof createMemoryRepositoryReader }>(
      'projects/repository/dist/memory.js',
    ),
    importBuilt<{ anthropicAdapter: IRuntimeAdapter }>('projects/adapter-anthropic/dist/index.js'),
    importBuilt<{ eveAdapter: IRuntimeAdapter }>('projects/adapter-eve/dist/index.js'),
  ]);
  const results: ICalibrationResult[] = [];

  for (const workload of CALIBRATION_WORKLOADS) {
    const adapter =
      workload === 'deep-eve' || workload === 'broad-eve'
        ? eve.eveAdapter
        : anthropic.anthropicAdapter;
    const samples: ICalibrationSample[] = [];

    for (let index = 0; index < 3; index += 1) {
      samples.push(await measure(workload, core, memory, adapter));
    }

    results.push({ samples, workload });
  }

  return results;
};

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename) {
  const argumentIndex = process.argv.indexOf('--package-root');
  const packageRoot =
    argumentIndex === -1
      ? path.resolve(import.meta.dirname, '../..')
      : process.argv[argumentIndex + 1];

  if (packageRoot === undefined || packageRoot.startsWith('--')) {
    throw new TypeError('Expected a directory after --package-root.');
  }

  console.log(JSON.stringify(await runCalibration(path.resolve(packageRoot)), null, 2));
}
