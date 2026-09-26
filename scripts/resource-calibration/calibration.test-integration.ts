// @vitest-environment node
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { runCalibration } from './calibration.ts';
import { CALIBRATION_WORKLOADS, createCalibrationEntries } from './fixtures.ts';

describe('complete-workflow resource calibration', () => {
  test('keeps every synthetic path portable and fixture definitions isolated', () => {
    for (const workload of CALIBRATION_WORKLOADS) {
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

  test('reports measured reads, parser work, bounded pages, and output for each workflow', async () => {
    const packageRoot = path.resolve(import.meta.dirname, '../..');
    const results = await runCalibration(packageRoot);

    expect(results.map((result) => result.workload)).toStrictEqual(CALIBRATION_WORKLOADS);
    for (const result of results) {
      expect(result.samples).toHaveLength(3);
      for (const sample of result.samples) {
        expect(sample.bytesRead).toBeGreaterThan(0);
        expect(sample.readPages).toBeGreaterThan(0);
        expect(sample.parserInvocations).toBeGreaterThan(0);
        expect(sample.records).toBeGreaterThan(0);
        expect(sample.outputBytes).toBeGreaterThan(0);
        expect(sample.snapshotAccesses).toBeGreaterThan(0);
        expect(sample.snapshotAttempts).toBe(1);
        expect(sample.logicalPeakRetainedBytes).toBeGreaterThan(0);
        expect(sample.logicalPreparedBytes).toBeGreaterThan(0);
        expect(sample.peakHeapBytes).toBeGreaterThanOrEqual(sample.heapBaselineBytes);
      }
    }
    expect(
      results.find((result) => result.workload === 'multi-page')?.samples[0]?.inspectionPages,
    ).toBeGreaterThan(1);
    expect(
      results
        .find((result) => result.workload === 'broad-eve')
        ?.samples.map((sample) => sample.handoffRegistrations),
    ).toStrictEqual([81, 81, 81]);
  });
});
