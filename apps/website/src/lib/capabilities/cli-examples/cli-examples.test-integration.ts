// @vitest-environment node
import { fileURLToPath } from 'node:url';

import { beforeAll, expect, test } from 'vitest';

import { discoverPublicPackages } from '../../generation/generation.ts';
import type { IPublicPackage } from '../../model/types.ts';
import type { ICapabilityCase } from '../index.ts';

import { createCliExamples } from './cli-examples.ts';

const repositoryRoot = fileURLToPath(new URL('../../../../../../', import.meta.url));
let packages: IPublicPackage[];
let examples: ICapabilityCase[];
beforeAll(async () => {
  packages = discoverPublicPackages(repositoryRoot);
  examples = await createCliExamples(repositoryRoot, packages);
});

test('executes every public command with actual schema 6 status and process outcomes', () => {
  expect(examples).toHaveLength(10);
  expect(
    examples.map(({ result }) =>
      result.kind === 'cli' ? [result.schemaVersion, result.status, result.exitStatus] : null,
    ),
  ).toStrictEqual([
    [6, 'valid', 0],
    [6, 'valid', 0],
    [6, 'valid', 0],
    [6, 'valid', 0],
    [6, 'valid', 0],
    [6, 'valid', 0],
    [6, 'error', 3],
    [6, 'valid', 0],
    [6, 'invalid', 1],
    [6, 'valid', 0],
  ]);
});

test('publishes the executed schema 6 version warning without a false failure', () => {
  expect(examples.find(({ id }) => id === 'cli-version-warning')?.result).toMatchObject({
    kind: 'cli',
    schemaVersion: 6,
    status: 'valid',
    exitStatus: 0,
    facts: {
      valid: true,
      runtimeInspection: 'incomplete',
      diagnosticCount: 1,
      errorCount: 0,
      warningCount: 1,
      diagnostics: [
        {
          code: 'CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED',
          severity: 'warning',
          details: {
            relationship: 'instruction-loader',
            reason: 'version-dependent-behavior',
            packageName: '@cloudflare/think',
            declaredRange: '>=0.17.0',
            boundaryVersion: '0.18.0',
          },
        },
      ],
    },
  });
});

test('distinguishes a project failure that prevented runtime inspection', () => {
  expect(examples.find(({ id }) => id === 'cli-invalid-project')?.result).toMatchObject({
    kind: 'cli',
    status: 'invalid',
    exitStatus: 1,
    facts: { valid: false, runtimeInspection: 'not-run' },
  });
});

test('exercises both changed-path inputs and Git selection without exposing document bodies', () => {
  expect(examples.find(({ id }) => id === 'cli-scope-path')?.result).toMatchObject({
    kind: 'cli',
    facts: { relevant: true, counts: { inputPaths: 1, matchedPaths: 1 } },
  });
  expect(examples.find(({ id }) => id === 'cli-scope-stdin')?.result).toMatchObject({
    kind: 'cli',
    facts: { relevant: true, counts: { inputPaths: 2, matchedPaths: 1 } },
  });
  expect(examples.find(({ id }) => id === 'cli-inspect-selection')?.result).toMatchObject({
    kind: 'cli',
    facts: {
      paths: [
        '/moldea/context/long-policy.md',
        '/moldea/context/tracked.md',
        '/moldea/context/untracked.md',
        '/moldea/moldea.yaml',
        '/moldea/project.md',
      ],
    },
  });
  for (const example of examples.filter(({ operation }) => operation !== 'content'))
    expect(JSON.stringify(example.result)).not.toMatch(/"content":/u);
});

test('reconstructs bounded content, checks installed composition, and leaves Git/files untouched on every run', async () => {
  const repeated = await createCliExamples(repositoryRoot, packages);
  expect(repeated).toStrictEqual(examples);
  expect(examples.find(({ id }) => id === 'cli-content-continuation')?.result).toMatchObject({
    kind: 'cli',
    facts: {
      chunks: [
        { byteStart: 0, byteEnd: 2048, totalBytes: 7040, hasContinuation: true },
        { byteStart: 2048, byteEnd: 4096, totalBytes: 7040, hasContinuation: true },
        { byteStart: 4096, byteEnd: 6144, totalBytes: 7040, hasContinuation: true },
        { byteStart: 6144, byteEnd: 7040, totalBytes: 7040, hasContinuation: false },
      ],
    },
  });
  const serialized = JSON.stringify(repeated);
  expect(serialized).not.toContain(repositoryRoot);
  expect(serialized).not.toMatch(/moldea-capabilities-|"(?:cursor|processId|snapshotIdentity)":/u);
});

test('fails before running fixture commands when the public CLI package is absent', async () => {
  await expect(
    createCliExamples(
      repositoryRoot,
      packages.filter(({ name }) => name !== '@moldea.ai/cli'),
    ),
  ).rejects.toThrow('CLI capability package is unavailable');
});
