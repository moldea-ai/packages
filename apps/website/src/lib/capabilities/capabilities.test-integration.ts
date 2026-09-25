// @vitest-environment node
import { fileURLToPath } from 'node:url';

import { beforeAll, expect, test } from 'vitest';

import { createWebsiteModel } from '../generation/generation.ts';
import type { IWebsiteModel } from '../model/types.ts';
import type { IRuntimeCompatibilityPublicationV1 } from '../runtime-compatibility-publication/index.ts';

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

test('accounts for every release-owned operation, diagnostic, target, and inspected pattern', () => {
  const catalog = model.capabilities;
  expect(catalog.cases).toHaveLength(137);
  expect(Object.keys(catalog.coreOperations)).toHaveLength(8);
  expect(Object.keys(catalog.diagnostics)).toHaveLength(82);
  expect(catalog.runtimeTargets).toHaveLength(14);
  expect(catalog.runtimeTargets.flatMap(({ patterns }) => patterns)).toHaveLength(95);
  expect(() =>
    validateCapabilities(catalog, model.runtimeCompatibilityPublication, sourcePaths),
  ).not.toThrow();
  for (const coverage of Object.values(catalog.diagnostics)) {
    expect(coverage.mode === 'demonstrated').toBe(coverage.caseIds.length > 0);
  }
});

test('regenerates identical published facts without host paths, cursors, or opaque reader identities', async () => {
  const repositoryRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
  const repeated = await createCapabilities(
    repositoryRoot,
    model.packages,
    model.runtimeCompatibilityPublication,
  );
  expect(repeated).toStrictEqual(model.capabilities);
  expect(JSON.stringify(repeated)).not.toMatch(
    /"(?:cursor|nextCursor|snapshotIdentity|contentIdentity)":|moldea-capabilities-/u,
  );
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
    'missing target',
    (catalog) => {
      catalog.runtimeTargets.pop();
    },
  ],
  [
    'stale pattern',
    (catalog) => {
      const first = catalog.runtimeTargets[0]?.patterns[0];
      if (first) first.id = 'unknown-pattern';
    },
  ],
  [
    'missing witness',
    (catalog) => {
      const first = catalog.runtimeTargets[0]?.patterns[0];
      if (first) first.proofs = [];
    },
  ],
  [
    'stale target route',
    (catalog) => {
      const first = catalog.runtimeTargets[0];
      if (first) first.scopeRoute = '/not-a-target/';
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
  expect(() =>
    validateCapabilities(catalog, model.runtimeCompatibilityPublication, sourcePaths),
  ).toThrow();
});

test('rejects canonical target or pattern removal instead of silently shrinking coverage', () => {
  const publication = structuredClone(model.runtimeCompatibilityPublication);
  const adapter = Object.values(publication.adapters).find(
    ({ targets }) => targets !== undefined && targets.length > 0,
  );
  expect(adapter).toBeDefined();
  adapter?.targets?.pop();
  expect(() => validateCapabilities(model.capabilities, publication, sourcePaths)).toThrow();
});

test('rejects unsafe qualification links even if they match the supplied publication', () => {
  const catalog = structuredClone(model.capabilities);
  const publication: IRuntimeCompatibilityPublicationV1 = structuredClone(
    model.runtimeCompatibilityPublication,
  );
  const runtime = catalog.runtimeTargets.find(
    ({ target }) => target.qualificationEvidence !== undefined,
  );
  expect(runtime).toBeDefined();
  if (runtime === undefined || runtime.target.qualificationEvidence === undefined) return;
  runtime.target.qualificationEvidence.url = 'https://user:password@example.com/qualification';
  const target = publication.adapters[runtime.adapterId]?.targets?.find(
    ({ id }) => id === runtime.target.id,
  );
  if (target?.qualificationEvidence === undefined)
    throw new Error('Expected qualification fixture is missing.');
  target.qualificationEvidence.url = runtime.target.qualificationEvidence.url;
  expect(() => validateCapabilities(catalog, publication, sourcePaths)).toThrow();
});
