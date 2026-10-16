// @vitest-environment node
import { expect, test } from 'vitest';
import { createCore } from '@moldea.ai/core';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { MANAGED_INTEGRATION_ENTRIES } from '../capabilities/integration-fixture/index.ts';

import { INSPECTION_SNAPSHOTS } from './constants.ts';
import { createInspectionExample } from './inspection-example.ts';

test('generates reproducible pass, fail, pass responses from real Core checks', async () => {
  const states = await createInspectionExample();

  expect(states.map(({ result }) => result.valid)).toStrictEqual([true, false, true]);
  expect(states.map(({ result }) => [result.errorCount, result.warningCount])).toStrictEqual([
    [0, 0],
    [1, 0],
    [0, 0],
  ]);
  expect(states.map(({ result }) => result.coverageCounts)).toStrictEqual([
    { bindings: 1, exportsPassed: 1, exportsFailed: 0, exportsNotChecked: 0 },
    { bindings: 0, exportsPassed: 0, exportsFailed: 0, exportsNotChecked: 0 },
    { bindings: 1, exportsPassed: 1, exportsFailed: 0, exportsNotChecked: 0 },
  ]);
  expect(states.map(({ declaredPath, sourcePath }) => [declaredPath, sourcePath])).toStrictEqual([
    ['/src/refund-policy.ts', '/src/refund-policy.ts'],
    ['/src/refund-policy.ts', '/src/payments/refund-policy.ts'],
    ['/src/payments/refund-policy.ts', '/src/payments/refund-policy.ts'],
  ]);
  expect(states[1].result.diagnostics).toStrictEqual([
    {
      code: 'MOLDEA_REFERENCE_MISSING',
      message: 'The referenced repository path does not exist.',
      path: '/moldea/moldea.yaml',
      pointer: '/context/~1moldea~1project.md/bindings/0',
      details: { referencedPath: '/src/refund-policy.ts' },
      severity: 'error',
      source: 'core',
      group: 'references',
      entity: { contextPath: '/moldea/project.md' },
      range: null,
    },
  ]);
  expect(states).toStrictEqual(await createInspectionExample());

  for (const state of states) {
    expect(state.projectPath).toBe('/moldea/project.md');
    const snapshot = INSPECTION_SNAPSHOTS.find(({ id }) => id === state.id)!;
    const expected = await createCore().validateProject({
      repository: createMemoryRepositoryReader([
        ...MANAGED_INTEGRATION_ENTRIES,
        { path: '/moldea/moldea.yaml', type: 'file', content: snapshot.manifest },
        { path: '/moldea/project.md', type: 'file', content: snapshot.project },
        { path: snapshot.sourcePath, type: 'file', content: snapshot.source },
      ]),
    });
    expect(JSON.parse(JSON.stringify(state.result))).toStrictEqual(
      JSON.parse(JSON.stringify(expected)),
    );

    // the declared symbol is manifest data; project and source bodies must stay out of results
    expect(JSON.stringify(state.result)).not.toMatch(/manager approval|pending-approval/iu);
  }
});

test('does not mistake a resolved path for a semantic check of source behavior', async () => {
  const snapshots = structuredClone(INSPECTION_SNAPSHOTS);
  snapshots[0].source = "export const reviewRefund = () => 'approved';\n";

  const states = await createInspectionExample(snapshots);

  expect(states[0].result).toMatchObject({
    valid: true,
    errorCount: 0,
    warningCount: 0,
    diagnostics: [],
  });
});

test.each(['connected', 'broken', 'repaired'])(
  'rejects an unexpected result for %s',
  async (id) => {
    const snapshots = structuredClone(INSPECTION_SNAPSHOTS);
    const snapshot = snapshots.find((candidate) => candidate.id === id)!;
    snapshot.sourcePath = id === 'broken' ? '/src/refund-policy.ts' : '/src/unbound.ts';

    await expect(createInspectionExample(snapshots)).rejects.toThrow(
      `The inspection example produced unexpected Core results for ${id}.`,
    );
  },
);

test('rejects a resolved state whose export check cannot run', async () => {
  const snapshots = structuredClone(INSPECTION_SNAPSHOTS);
  snapshots[0].manifest = snapshots[0].manifest.replace('        symbol: reviewRefund\n', '');

  await expect(createInspectionExample(snapshots)).rejects.toThrow(
    'unexpected Core results for connected',
  );
});

test('rejects additional diagnostics, malformed fixtures, and missing or reordered states', async () => {
  const snapshots = structuredClone(INSPECTION_SNAPSHOTS);
  snapshots[1].manifest += '      - path: /src/another-missing.ts\n';
  await expect(createInspectionExample(snapshots)).rejects.toThrow(
    'unexpected Core results for broken',
  );
  snapshots[0].manifest = 'version: invalid\n';
  await expect(createInspectionExample(snapshots)).rejects.toThrow(
    'unexpected Core results for connected',
  );
  await expect(createInspectionExample([])).rejects.toThrow(
    'must contain connected, broken, and repaired',
  );
  await expect(createInspectionExample([...INSPECTION_SNAPSHOTS].reverse())).rejects.toThrow(
    'must contain connected, broken, and repaired',
  );
});
