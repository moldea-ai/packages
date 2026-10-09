// @vitest-environment node
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { runCalibration } from './calibration.ts';
import {
  CALIBRATION_WORKLOADS,
  NODE_CALIBRATION_WORKLOADS,
  createCalibrationEntries,
} from './fixtures.ts';

describe('complete-workflow resource calibration', () => {
  test('keeps every synthetic path portable and fixture definitions isolated', () => {
    for (const workload of NODE_CALIBRATION_WORKLOADS) {
      const entries = createCalibrationEntries(workload);

      expect(entries.length).toBeGreaterThan(0);
      expect(new Set(entries.map((entry) => entry.path)).size).toBe(entries.length);
      expect(
        entries.every(
          (entry) =>
            entry.path.startsWith('/') &&
            entry.path.length <= 160 &&
            entry.path
              .split('/')
              .slice(1)
              .every(
                (component) =>
                  component.length <= 64 &&
                  /^[a-z0-9._-]+$/u.test(component) &&
                  !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(component) &&
                  !component.endsWith('.'),
              ),
        ),
      ).toBe(true);
    }
  });

  test.each(CALIBRATION_WORKLOADS)(
    'measures the complete %s workflow',
    async (workload) => {
      const packageRoot = path.resolve(import.meta.dirname, '../..');
      const results = await runCalibration(packageRoot, [workload]);

      expect(results.map((result) => result.workload)).toStrictEqual([workload]);
      for (const result of results) {
        expect(result.samples).toHaveLength(3);
        for (const [index, sample] of result.samples.entries()) {
          expect(sample.bytesRead).toBeGreaterThan(0);
          expect(sample.readPages).toBeGreaterThan(0);
          expect(sample.isolatedProcess).toBe(true);
          expect(sample.parserCoverageEnabled).toBe(index === 0);
          if (index === 0) expect(sample.parserInvocations).toBeGreaterThan(0);
          else expect(sample.parserInvocations).toBeNull();
          expect(sample.nativePeakRssBytes).toBeGreaterThan(0);
          expect(sample.records).toBeGreaterThan(0);
          // Shared agents deliberately call the base agent's canonical loader.
          expect(sample.validationErrors).toBe(
            [
              'shared-source-many-agent',
              'dense-diagnostic',
              'multi-page',
              'distinct-source',
              'over-capacity',
              'imported-mutation',
            ].includes(result.workload)
              ? 64
              : 0,
          );
          expect(sample.outputBytes).toBeGreaterThan(0);
          expect(sample.snapshotAccesses).toBeGreaterThan(0);
          expect(sample.snapshotAttempts).toBe(1);
          expect(sample.logicalPeakRetainedBytes).toBeGreaterThan(0);
          expect(sample.logicalPreparedBytes).toBeGreaterThan(0);
          expect(sample.peakHeapBytes).toBeGreaterThanOrEqual(sample.heapBaselineBytes);
        }
      }
      const [result] = results;
      expect(result).toBeDefined();
      if (workload === 'multi-page') {
        expect(result?.samples[0]?.inspectionPages).toBeGreaterThan(1);
      }
      if (workload === 'broad-eve') {
        expect(result?.samples.map((sample) => sample.handoffRegistrations)).toStrictEqual([
          81, 81, 81,
        ]);
      }
      if (workload === 'mixed-adapters') {
        expect(result?.samples.map((sample) => sample.adaptersInvoked)).toStrictEqual([10, 10, 10]);
      }
      if (workload === 'broad-tool') {
        expect(result?.samples.map((sample) => sample.toolRegistrations)).toStrictEqual([
          65, 65, 65,
        ]);
      }
      if (workload.startsWith('dense-eve-')) {
        const toolCount = Number(workload.slice('dense-eve-'.length));
        expect(result?.samples.map((sample) => sample.toolRegistrations)).toStrictEqual([
          toolCount,
          toolCount,
          toolCount,
        ]);
      }
    },
    // One bounded profiled subprocess and two bounded unprofiled subprocesses.
    600_000,
  );
});
