// @vitest-environment node
import { fileURLToPath } from 'node:url';

import { beforeAll, expect, test } from 'vitest';

import { createWebsiteModel } from '../generation/generation.ts';
import type { IWebsiteModel } from '../model/types.ts';

import { createCapabilities } from './capabilities.ts';
import type { ICapabilities } from './types.ts';
import { validateCapabilities } from './validations.ts';

let model: IWebsiteModel;
let sourcePaths: Set<string>;
beforeAll(async () => {
  model = await createWebsiteModel();
  sourcePaths = new Set([
    'specifications/repository-format.md',
    ...model.packages.flatMap(({ documents }) => documents.map(({ sourcePath }) => sourcePath)),
  ]);
});

test('accounts for every release-owned operation and diagnostic', () => {
  const catalog = model.capabilities;
  expect(catalog.cases).toHaveLength(118);
  expect(Object.keys(catalog.coreOperations)).toHaveLength(8);
  expect(Object.keys(catalog.diagnostics)).toHaveLength(87);
  expect(() => validateCapabilities(catalog, sourcePaths)).not.toThrow();
  for (const coverage of Object.values(catalog.diagnostics)) {
    expect(coverage.mode === 'demonstrated').toBe(coverage.caseIds.length > 0);
  }
});

test('regenerates identical published facts with complete repeatable output and without host paths', async () => {
  const repositoryRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
  const repeated = await createCapabilities(repositoryRoot, model.packages);
  expect(repeated).toStrictEqual(model.capabilities);
  expect(JSON.stringify(repeated)).not.toMatch(/moldea-capabilities-/u);
  expect(JSON.stringify(repeated)).not.toContain(repositoryRoot);
});

test.each<[string, (catalog: ICapabilities) => void]>([
  [
    'missing case',
    (catalog) => {
      catalog.cases.pop();
    },
  ],
  [
    'duplicate case',
    (catalog) => {
      const first = catalog.cases[0];
      if (first) catalog.cases.push(first);
    },
  ],
  [
    'unknown source',
    (catalog) => {
      const first = catalog.cases[0];
      if (first) first.sourcePaths = ['missing/document.md'];
    },
  ],
  [
    'unsafe source',
    (catalog) => {
      const first = catalog.cases[0];
      if (first) first.sourcePaths = ['../README.md'];
    },
  ],
  [
    'empty operation',
    (catalog) => {
      catalog.coreOperations.parseDecision = [];
    },
  ],
  [
    'unproved diagnostic',
    (catalog) => {
      catalog.diagnostics.MOLDEA_TEXT_INVALID_UTF8.caseIds = ['agent-valid'];
    },
  ],
  [
    'invalid result mislabelled',
    (catalog) => {
      const result = catalog.cases.find(({ id }) => id === 'utf8-invalid')?.result;
      if (result?.kind === 'validation') result.valid = true;
    },
  ],
  [
    'CLI failure with a success exit',
    (catalog) => {
      const result = catalog.cases.find(({ id }) => id === 'cli-invalid-project')?.result;
      if (result?.kind === 'cli') result.exitStatus = 0;
    },
  ],
])('validateCapabilities(%s) -> rejected', (_name, mutate) => {
  const catalog = structuredClone(model.capabilities);
  mutate(catalog);
  expect(catalog).not.toStrictEqual(model.capabilities);
  expect(() => validateCapabilities(catalog, sourcePaths)).toThrow();
});
