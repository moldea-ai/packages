// @vitest-environment node
import { expect, test } from 'vitest';

import { getCapabilityOutcome } from '../presentation.ts';
import { createBindingExamples } from './binding-examples.ts';

test('executes the binding and warning inventory without treating unchecked exports as errors', async () => {
  const cases = await createBindingExamples();
  expect(cases).toHaveLength(12);
  expect(await createBindingExamples()).toStrictEqual(cases);
  for (const id of ['binding-commonjs', 'binding-unresolved', 'binding-unparseable']) {
    const example = cases.find((example) => example.id === id)!;
    expect(example.result).toMatchObject({
      valid: true,
      errorCount: 0,
      coverageCounts: { exportsNotChecked: 1 },
    });
    expect(getCapabilityOutcome(example).label).toBe('Not checked');
  }
  expect(cases.find(({ id }) => id === 'binding-export-missing')?.result).toMatchObject({
    valid: false,
    errorCount: 1,
    coverageCounts: { exportsFailed: 1 },
  });
  expect(getCapabilityOutcome(cases.find(({ id }) => id === 'warning-accepted')!).label).toBe(
    'Accepted',
  );
  for (const example of cases.filter(({ id }) => id.startsWith('integration-'))) {
    expect(example.result).toMatchObject({
      valid: true,
      warningCount: 1,
      diagnostics: [
        { group: 'integration', severity: 'warning', subject: '/AGENTS.md', qualifier: null },
      ],
    });
  }
});
