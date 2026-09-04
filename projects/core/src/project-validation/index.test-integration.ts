// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';
import {
  createMemoryRepositoryReader,
  type IMemoryRepositoryEntry,
} from '../repository.test-fixtures.js';

import { createCore } from '../core/index.js';

interface IFixtureEntry {
  readonly path: string;
  readonly type: 'file' | 'directory' | 'symlink';
  readonly text?: string;
  readonly bytes?: readonly number[];
}

interface IRepositoryFixtureCase {
  readonly manifest: string;
  readonly entries: readonly IFixtureEntry[];
}

interface IProjectValidationFixture {
  readonly cases: readonly (IRepositoryFixtureCase & {
    readonly name: string;
    readonly expectedFormatVersion: 1;
    readonly expectedProjectFixture: string | null;
  })[];
}

interface ICustomRuntimeFixture {
  readonly cases: readonly (IRepositoryFixtureCase & {
    readonly name: string;
    readonly expectedGuidancePaths: readonly string[];
  })[];
}

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../../fixtures/core/project-index/cases.json', import.meta.url),
    'utf8',
  ),
) as IProjectValidationFixture;
const expectedDiagnosticsByCase = JSON.parse(
  readFileSync(
    new URL('../../../../fixtures/core/project-index/diagnostics.expected.json', import.meta.url),
    'utf8',
  ),
) as Readonly<Record<string, readonly unknown[]>>;
const customRuntimeFixture = JSON.parse(
  readFileSync(
    new URL('../../../../fixtures/core/custom-runtime/cases.json', import.meta.url),
    'utf8',
  ),
) as ICustomRuntimeFixture;
const manifestPath = parseRepositoryPath('/moldea/moldea.yaml');

const createEntries = (fixtureCase: IRepositoryFixtureCase): readonly IMemoryRepositoryEntry[] => [
  { content: fixtureCase.manifest, path: manifestPath, type: 'file' },
  ...fixtureCase.entries.map((entry): IMemoryRepositoryEntry => {
    if (entry.type !== 'file') {
      return { path: entry.path, type: entry.type };
    }

    if (entry.bytes !== undefined) {
      return { content: Uint8Array.from(entry.bytes), path: entry.path, type: 'file' };
    }

    if (entry.text === undefined) {
      throw new TypeError('A project-index file fixture must include text or bytes.');
    }

    return { content: entry.text, path: entry.path, type: 'file' };
  }),
];

const toJsonValue = (candidate: unknown): unknown =>
  JSON.parse(JSON.stringify(candidate)) as unknown;

describe('public Core project validation', () => {
  test.each(fixture.cases)('returns the exact public result for $name', async (case_) => {
    const result = await createCore().validateProject({
      repository: createMemoryRepositoryReader(createEntries(case_)),
    });
    const expectedDiagnostics = expectedDiagnosticsByCase[case_.name];

    if (expectedDiagnostics === undefined) {
      throw new TypeError(`The ${case_.name} diagnostic golden is required.`);
    }

    expect(toJsonValue(result.diagnostics)).toStrictEqual(expectedDiagnostics);
    expect(result.evidence).toStrictEqual([]);
    expect(result.formatVersion).toBe(case_.expectedFormatVersion);
    expect(result.valid).toBe(case_.expectedProjectFixture !== null);
    expect(result.summary === null).toBe(case_.expectedProjectFixture === null);
    expect(JSON.stringify(result)).not.toContain('"content"');
    expect(JSON.stringify(result)).not.toContain('"body"');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);
    expect(Object.isFrozen(result.evidence)).toBe(true);
    expect(result.summary === null || Object.isFrozen(result.summary)).toBe(true);
  });

  test.each(customRuntimeFixture.cases)(
    'supports $name through the universal memory-reader path',
    async (case_) => {
      const core = createCore();
      const repository = createMemoryRepositoryReader(createEntries(case_));
      const firstResult = await core.validateProject({ repository });
      const secondResult = await core.validateProject({ repository });
      const inspection = await core.inspectProjectPage({
        maxItems: 256,
        repository,
        view: 'metadata',
      });
      expect(toJsonValue(secondResult)).toStrictEqual(toJsonValue(firstResult));
      expect(firstResult.valid).toBe(true);
      expect(firstResult.diagnostics).toStrictEqual([]);
      expect(firstResult.evidence).toStrictEqual([]);
      expect(firstResult.formatVersion).toBe(1);
      expect(firstResult.summary?.counts.agents).toBe(1);
      expect(
        inspection.page.records
          .map(({ item }) => item)
          .filter((item) => item.kind === 'metadata')
          .map(({ metadata }) => metadata)
          .filter(({ kind }) => kind === 'runtime-guidance')
          .map(({ path }) => path),
      ).toStrictEqual(case_.expectedGuidancePaths);
    },
  );
});
