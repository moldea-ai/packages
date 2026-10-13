// @vitest-environment node
import { expect, test, vi } from 'vitest';

import { DIAGNOSTIC_GROUP_PRESENTATIONS, FINDING_CATEGORY_PRESENTATIONS } from './constants.js';

// Real icon rendering is verified by the packed Astro consumer browser test.
vi.mock('@lucide/astro', () =>
  Object.fromEntries(
    [
      'ArrowDownToLine',
      'ArrowUpFromLine',
      'Bot',
      'CircleAlert',
      'FileBraces',
      'Files',
      'Handshake',
      'LifeBuoy',
      'Link2',
      'PlugZap',
      'ScanSearch',
      'ScrollText',
      'SquareDashed',
      'Target',
      'TriangleAlert',
      'Variable',
      'Wrench',
    ].map((name) => [name, () => null]),
  ),
);

test('keeps the documented cross-stack inspection subject ids complete', () => {
  expect(Object.keys(DIAGNOSTIC_GROUP_PRESENTATIONS)).toStrictEqual([
    'discovery',
    'manifest',
    'references',
    'agents',
    'mirrors',
    'integration',
  ]);
  expect(Object.keys(FINDING_CATEGORY_PRESENTATIONS)).toStrictEqual([
    'responsibility',
    'scope',
    'inputs',
    'outputs',
    'capabilities',
    'handoffs',
    'variables',
    'failureBehavior',
    'context',
    'connection',
    'unclassified',
  ]);
  expect(FINDING_CATEGORY_PRESENTATIONS.context.label).toBe('Project context');
});
