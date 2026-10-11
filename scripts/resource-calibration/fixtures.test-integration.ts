// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { createCore } from '../../projects/core/src/index.ts';
import { createMemoryRepositoryReader } from '../../projects/repository/dist/memory.js';

import { createCalibrationEntries, NODE_CALIBRATION_WORKLOADS } from './fixtures.ts';

describe('universal packed-consumer fixtures', () => {
  test.each(NODE_CALIBRATION_WORKLOADS)(
    'preserves the %s result and bounded fixture paths',
    async (workload) => {
      const entries = createCalibrationEntries(workload);
      expect(new Set(entries.map(({ path }) => path)).size).toBe(entries.length);
      for (const { path } of entries) {
        expect(path.length).toBeLessThanOrEqual(160);
        for (const component of path.slice(1).split('/')) {
          expect(component.length).toBeLessThanOrEqual(64);
          expect(component).toMatch(/^[a-z0-9._-]+$/iu);
          expect(component).not.toMatch(/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu);
          expect(component.endsWith('.')).toBe(false);
        }
      }
      const result = await createCore().validateProject({
        repository: createMemoryRepositoryReader(entries),
      });
      const errors =
        workload === 'maximum-diagnostic' ? 10_000 : workload === 'dense-diagnostic' ? 64 : 0;
      expect(result.errorCount).toBe(errors);
      expect(result.warningCount).toBe(0);
      expect(result.acceptedWarningCount).toBe(0);
      expect(result.diagnosticCount).toBe(errors);
      expect(result.valid).toBe(errors === 0);
      if (workload === 'ordinary')
        expect(result.coverageCounts).toStrictEqual({
          bindings: 1,
          exportsPassed: 1,
          exportsFailed: 0,
          exportsNotChecked: 0,
        });
      if (workload === 'dense-diagnostic') expect(result.coverageCounts.exportsFailed).toBe(64);
      if (workload === 'shared-source-many-agent')
        expect(result.coverageCounts.exportsPassed).toBe(64);
      if (workload === 'broad-tool') expect(result.coverageCounts.exportsPassed).toBe(65);
      if (workload === 'large-syntax' || workload.startsWith('large-'))
        expect(result.coverage).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              exportCheck: 'not-checked',
              exportNotCheckedReason: 'resource-limit',
            }),
          ]),
        );
    },
  );
});
