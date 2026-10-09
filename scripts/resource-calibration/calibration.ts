import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Session } from 'node:inspector';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

import type { IRuntimeAdapter } from '../../projects/core/src/adapter/index.ts';
import type { createCore } from '../../projects/core/src/index.ts';
import type { IRepositoryReader } from '../../projects/repository/src/contracts.ts';
import type { createMemoryRepositoryReader } from '../../projects/repository/src/memory.ts';

import {
  CALIBRATION_RUNTIME_IDS,
  CALIBRATION_WORKLOADS,
  createCalibrationEntries,
} from './fixtures.ts';

interface IReaderMetrics {
  bytesRead: number;
  entryLookups: number;
  listingPages: number;
  readPages: number;
  snapshotAccesses: number;
  snapshotAttempts: number;
}

interface ICalibrationSample extends IReaderMetrics {
  adaptersInvoked: number;
  cpuMilliseconds: number;
  elapsedMilliseconds: number;
  handoffRegistrations: number;
  heapBaselineBytes: number;
  inspectionPages: number;
  logicalPeakRetainedBytes: number;
  logicalPreparedBytes: number;
  outputBytes: number;
  parserInvocations: number | null;
  parserCoverageEnabled: boolean;
  peakHeapBytes: number;
  peakRssBytes: number;
  nativePeakRssBytes: number;
  isolatedProcess: boolean;
  records: number;
  toolRegistrations: number;
  validationErrors: number;
}

interface ICalibrationResult {
  workload: string;
  samples: readonly ICalibrationSample[];
}

const encoder = new TextEncoder();

const createMeasuredReader = (
  reader: IRepositoryReader,
  metrics: IReaderMetrics,
  observeMemory: () => void,
): IRepositoryReader => ({
  get snapshot() {
    metrics.snapshotAccesses += 1;
    return reader.snapshot;
  },
  compare: (candidate, options) => reader.compare(candidate, options),
  getEntry: async (filePath, options) => {
    metrics.entryLookups += 1;
    const entry = await reader.getEntry(filePath, options);
    observeMemory();
    return entry;
  },
  listEntriesPage: async (options) => {
    metrics.listingPages += 1;
    return reader.listEntriesPage(options);
  },
  readFilePage: async (filePath, options) => {
    metrics.readPages += 1;
    const page = await reader.readFilePage(filePath, options);
    metrics.bytesRead += page.bytes.byteLength;
    observeMemory();
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
  adapters: IRuntimeAdapter[],
): Promise<ICalibrationSample> => {
  const observeMemory = (): void => {
    const memory = process.memoryUsage();
    peakHeapBytes = Math.max(peakHeapBytes, memory.heapUsed);
    peakRssBytes = Math.max(peakRssBytes, memory.rss);
  };
  const metrics: IReaderMetrics = {
    bytesRead: 0,
    entryLookups: 0,
    listingPages: 0,
    readPages: 0,
    snapshotAccesses: 0,
    snapshotAttempts: 0,
  };
  const repository = createMeasuredReader(
    memory.createMemoryRepositoryReader(
      createCalibrationEntries(
        workload,
        process.argv.includes('--syntax-bytes')
          ? Number(process.argv[process.argv.indexOf('--syntax-bytes') + 1])
          : undefined,
      ),
    ),
    metrics,
    observeMemory,
  );
  const inspector = new Session();
  const collectParserCoverage = !process.argv.includes('--no-parser-coverage');
  let coverageStarted = false;
  let inspectorConnected = false;

  const baselineMemory = process.memoryUsage();
  let peakHeapBytes = baselineMemory.heapUsed;
  let peakRssBytes = baselineMemory.rss;
  const memorySampler = setInterval(() => {
    const memory = process.memoryUsage();
    peakHeapBytes = Math.max(peakHeapBytes, memory.heapUsed);
    peakRssBytes = Math.max(peakRssBytes, memory.rss);
  }, 5);
  const startCpu = process.cpuUsage();
  const startTime = performance.now();

  try {
    if (collectParserCoverage) {
      inspector.connect();
      inspectorConnected = true;
      await postInspector(inspector, 'Profiler.enable');
      await postInspector(inspector, 'Profiler.startPreciseCoverage', {
        callCount: true,
        detailed: false,
      });
      coverageStarted = true;
    }
    const invokedAdapters = new Set<string>();
    const measuredAdapters = adapters.map((adapter) => ({
      ...adapter,
      inspect: (context: Parameters<IRuntimeAdapter['inspect']>[0]) => {
        invokedAdapters.add(adapter.id);
        return adapter.inspect(context);
      },
    }));
    const inspectionCore = core.createCore({ adapters: measuredAdapters });
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
    let toolRegistrations = 0;

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
      toolRegistrations += result.page.records.filter(
        ({ item }) => item.kind === 'evidence' && item.evidence.kind === 'tool-registration',
      ).length;
      outputBytes += encoder.encode(JSON.stringify(result)).byteLength;
      cursor = result.page.nextCursor ?? undefined;
    } while (cursor !== undefined);

    const elapsedMilliseconds = performance.now() - startTime;
    const cpu = process.cpuUsage(startCpu);
    const finalMemory = process.memoryUsage();
    peakHeapBytes = Math.max(peakHeapBytes, finalMemory.heapUsed);
    peakRssBytes = Math.max(peakRssBytes, finalMemory.rss);
    const coverage = collectParserCoverage
      ? await postInspector<Parameters<typeof countSourceParses>[0]>(
          inspector,
          'Profiler.takePreciseCoverage',
        )
      : null;

    return {
      ...metrics,
      adaptersInvoked: invokedAdapters.size,
      cpuMilliseconds: (cpu.user + cpu.system) / 1_000,
      elapsedMilliseconds,
      handoffRegistrations,
      heapBaselineBytes: baselineMemory.heapUsed,
      inspectionPages,
      logicalPeakRetainedBytes: inspection.resourceUsage.peakRetainedBytes,
      logicalPreparedBytes: inspection.resourceUsage.preparedBytes,
      outputBytes,
      parserInvocations: coverage === null ? null : countSourceParses(coverage),
      parserCoverageEnabled: collectParserCoverage,
      peakHeapBytes,
      peakRssBytes,
      nativePeakRssBytes: process.resourceUsage().maxRSS * 1024,
      isolatedProcess: true,
      records,
      toolRegistrations,
      validationErrors: inspection.counts.errors,
    };
  } finally {
    clearInterval(memorySampler);
    try {
      if (coverageStarted) await postInspector(inspector, 'Profiler.stopPreciseCoverage');
    } finally {
      if (inspectorConnected) inspector.disconnect();
    }
  }
};

/** Measures complete, bounded inspection workflows against built package artifacts. */
const runSample = async (
  packageRoot: string,
  workload: (typeof CALIBRATION_WORKLOADS)[number],
): Promise<ICalibrationSample> => {
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
  const adapter =
    workload === 'deep-eve' || workload === 'broad-eve' || workload.startsWith('dense-eve-')
      ? eve.eveAdapter
      : anthropic.anthropicAdapter;
  const adapters =
    workload === 'mixed-adapters'
      ? await Promise.all(
          CALIBRATION_RUNTIME_IDS.map(async (runtime) => {
            const exports = await importBuilt<Record<string, unknown>>(
              `projects/adapter-${runtime}/dist/index.js`,
            );
            const candidate = Object.values(exports).find(
              (candidate) =>
                typeof candidate === 'object' &&
                candidate !== null &&
                'id' in candidate &&
                candidate.id === runtime &&
                'inspect' in candidate &&
                typeof candidate.inspect === 'function',
            );
            if (candidate === undefined)
              throw new TypeError(`The ${runtime} calibration adapter is unavailable.`);
            // Core validates the complete adapter contract at its normal boundary.
            return candidate as IRuntimeAdapter;
          }),
        )
      : [adapter];
  return measure(workload, core, memory, adapters);
};

const executeFile = promisify(execFile);

/**
 * Measures complete bounded workflows in fresh processes, avoiding prior-workload RSS history.
 * Heap peaks remain sampled; native peak RSS includes synchronous parsing and active allocations.
 * @param packageRoot The candidate or baseline package build with the same calibration fixtures.
 * @param workloads The complete catalog by default, or an explicit subset for focused checks.
 * @returns One instrumented parse-count sample and two unprofiled samples per workload.
 * @throws Propagates failed inspections, process failures, and malformed sample output.
 */
export const runCalibration = async (
  packageRoot: string,
  workloads: readonly (typeof CALIBRATION_WORKLOADS)[number][] = CALIBRATION_WORKLOADS,
): Promise<readonly ICalibrationResult[]> => {
  const results: ICalibrationResult[] = [];
  for (const workload of workloads) {
    const samples: ICalibrationSample[] = [];
    for (let index = 0; index < 3; index += 1) {
      const { stdout } = await executeFile(
        process.execPath,
        [
          import.meta.filename,
          '--package-root',
          packageRoot,
          '--sample',
          workload,
          // Count parser calls separately from the two lower-overhead timing samples.
          ...(index === 0 ? [] : ['--no-parser-coverage']),
        ],
        {
          // Precise coverage disables parser optimizations: dense Eve took 181 s versus 27 s
          // unprofiled. Its separate diagnostic allowance does not raise inspection budgets.
          timeout: index === 0 ? 360_000 : 120_000,
          maxBuffer: 1_048_576,
        },
      );
      const sample = JSON.parse(stdout) as ICalibrationSample;
      if (sample.isolatedProcess !== true || !Number.isFinite(sample.nativePeakRssBytes)) {
        throw new TypeError('The isolated calibration sample is invalid.');
      }
      samples.push(sample);
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

  const sampleIndex = process.argv.indexOf('--sample');
  const workload = process.argv[sampleIndex + 1];
  if (
    sampleIndex !== -1 &&
    !CALIBRATION_WORKLOADS.includes(workload as (typeof CALIBRATION_WORKLOADS)[number])
  ) {
    throw new TypeError('Expected a supported workload after --sample.');
  }
  const result =
    sampleIndex === -1
      ? await runCalibration(path.resolve(packageRoot))
      : await runSample(
          path.resolve(packageRoot),
          workload as (typeof CALIBRATION_WORKLOADS)[number],
        );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
