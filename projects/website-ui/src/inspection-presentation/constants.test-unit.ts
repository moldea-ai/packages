// @vitest-environment node
import { expect, test, vi } from 'vitest';

import {
  Cable,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Expand,
  FileBraces,
  FileCog,
  Link2,
  Puzzle,
  Scale,
  ScanSearch,
  Wrench,
} from '@lucide/astro';

import {
  DIAGNOSTIC_GROUP_PRESENTATIONS,
  FINDING_CATEGORY_PRESENTATIONS,
  INSPECTION_BINDING_PRESENTATIONS,
  INSPECTION_IMPACT_PRESENTATIONS,
  INSPECTION_METADATA_ICONS,
} from './constants.js';

vi.mock('@lucide/astro', async () => {
  const { createInspectionIconMocks } = await import('./icons.test-fixtures.js');
  return createInspectionIconMocks();
});

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
    'failureBehavior',
    'context',
    'connection',
    'unclassified',
  ]);
  expect(FINDING_CATEGORY_PRESENTATIONS.context.label).toBe('Project context');
});

test('keeps the platform icon meanings and accepted impact distinct', () => {
  expect(DIAGNOSTIC_GROUP_PRESENTATIONS.manifest.icon).toBe(FileCog);
  expect(DIAGNOSTIC_GROUP_PRESENTATIONS.references.icon).toBe(Link2);
  expect(DIAGNOSTIC_GROUP_PRESENTATIONS.discovery.icon).toBe(ScanSearch);
  expect(FINDING_CATEGORY_PRESENTATIONS.scope.icon).toBe(Expand);
  expect(FINDING_CATEGORY_PRESENTATIONS.connection.icon).toBe(Cable);
  expect(FINDING_CATEGORY_PRESENTATIONS.unclassified.icon).toBe(Puzzle);
  expect(FINDING_CATEGORY_PRESENTATIONS.capabilities.icon).toBe(Wrench);
  expect(INSPECTION_METADATA_ICONS.declaration).toBe(FileBraces);
  expect(INSPECTION_METADATA_ICONS.decision).toBe(Scale);
  expect(INSPECTION_IMPACT_PRESENTATIONS.accepted).toMatchObject({
    label: 'Accepted',
    icon: CircleCheck,
    tone: 'success',
  });
  expect(INSPECTION_BINDING_PRESENTATIONS.failed).toMatchObject({
    label: 'Export missing',
    icon: CircleAlert,
  });
  expect(INSPECTION_BINDING_PRESENTATIONS['not-checked']).toMatchObject({
    label: 'Not checked',
    icon: CircleDashed,
  });
});
