// @vitest-environment node
import { expect, test } from 'vitest';

import { INSPECTION_SNAPSHOTS } from './constants.ts';
import { createInspectionExample } from './inspection-example.ts';

test('generates reproducible pass, fail, pass excerpts from real Core checks', async () => {
  const states = await createInspectionExample();

  expect(states.map(({ result }) => result.valid)).toStrictEqual([true, false, true]);
  expect(states[1].result.diagnostics).toStrictEqual([
    {
      code: 'MOLDEA_REFERENCE_MISSING',
      message: 'The referenced repository path does not exist.',
      path: '/moldea/moldea.yaml',
      pointer: '/context/~1moldea~1project.md/bindings/0',
      details: { referencedPath: '/src/refund-policy.ts' },
    },
  ]);
  expect(states).toStrictEqual(await createInspectionExample());

  for (const [index, state] of states.entries()) {
    const snapshot = INSPECTION_SNAPSHOTS[index];
    expect(state.repositoryMarkdown).toContain(snapshot.manifest);
    expect(state.repositoryMarkdown).toContain(snapshot.project);
    expect(state.repositoryMarkdown).toContain(snapshot.sourcePath);
    expect(state.repositoryMarkdown).toContain(snapshot.source);
    expect(state.resultMarkdown).toContain(JSON.stringify(state.result, null, 2));
    expect(state.resultMarkdown).not.toMatch(
      /manager approval|requiresManagerApproval|digest|snapshotId/iu,
    );
  }
});

test('does not mistake a resolved path for a semantic check of source behavior', async () => {
  const snapshots = structuredClone(INSPECTION_SNAPSHOTS);
  snapshots[0].source = 'export const requiresManagerApproval = false;\n';

  const states = await createInspectionExample(snapshots);

  expect(states[0].result).toStrictEqual({ valid: true, diagnostics: [] });
  expect(states[0].repositoryMarkdown).toContain(snapshots[0].source);
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
