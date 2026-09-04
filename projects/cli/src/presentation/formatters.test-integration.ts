// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import type { IProjectInspectionPageResult } from '@moldea.ai/core';
import {
  createMemoryRepositoryReader,
  type IMemoryRepositoryEntry,
} from '@moldea.ai/repository/memory';

import { executeMoldeaCliCoreInspection } from '../core-composition/index.js';
import { createMoldeaCliInspectExecutionResult } from '../cli-execution/results.js';

// repository-wide Core fixture shape used by the CLI presentation boundary
interface IProjectIndexFixture {
  readonly cases: readonly {
    readonly entries: readonly {
      readonly bytes?: readonly number[];
      readonly path: string;
      readonly text?: string;
      readonly type: 'directory' | 'file' | 'symlink';
    }[];
    readonly manifest: string;
    readonly name: string;
  }[];
}

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../../fixtures/core/project-index/cases.json', import.meta.url),
    'utf8',
  ),
) as IProjectIndexFixture;

/** Loads the complete repository-wide project fixture through the public memory reader. */
const inspectCompleteProject = async (): Promise<IProjectInspectionPageResult> => {
  const fixtureCase = fixture.cases.find(({ name }) => name === 'complete universal project');

  if (fixtureCase === undefined) {
    throw new TypeError('The complete universal project fixture is required.');
  }

  const entries: IMemoryRepositoryEntry[] = [
    { content: fixtureCase.manifest, path: '/moldea/moldea.yaml', type: 'file' },
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

  return (await executeMoldeaCliCoreInspection({
    command: 'inspect',
    repository: createMemoryRepositoryReader(entries),
    resourceLimits: {
      maxDiagnostics: 10_000,
      maxEntries: 100_000,
      maxEvidence: 10_000,
      maxFileBytes: 8_388_608,
      maxManifestBytes: 2_097_152,
      maxTotalBytes: 134_217_728,
    },
  })) as IProjectInspectionPageResult;
};

describe('CLI inspection presentation through Core and the memory repository reader', () => {
  test('emits bounded metadata without canonical bodies or adapter detail payloads', async () => {
    const inspection = await inspectCompleteProject();
    const execution = createMoldeaCliInspectExecutionResult(
      inspection,
      '7.0.0',
      true,
      null,
      65_536,
    );
    const envelope = JSON.parse(execution.stdout) as {
      readonly result: {
        readonly counts: Readonly<Record<string, number>>;
        readonly page: { readonly records: readonly { readonly kind: string }[] };
      };
      readonly schemaVersion: number;
    };

    expect(execution.exitCode).toBe(0);
    expect(Buffer.byteLength(execution.stdout, 'utf8')).toBeLessThanOrEqual(65_536);
    expect(envelope.schemaVersion).toBe(4);
    expect(envelope.result.counts).toMatchObject({ agents: 2, context: 2, decisions: 1 });
    expect(envelope.result.page.records.map(({ kind }) => kind)).toContain('metadata');
    expect(execution.stdout).not.toContain('Universal project.');
    expect(execution.stdout).not.toContain('"content"');
  });
});
