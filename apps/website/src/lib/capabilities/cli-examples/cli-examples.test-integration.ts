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

test('executes every public command with actual schema 4 status and process outcomes', () => {
  expect(examples).toHaveLength(9);
  expect(
    examples.map(({ result }) =>
      result.kind === 'cli' ? [result.schemaVersion, result.status, result.exitStatus] : null,
    ),
  ).toStrictEqual([
    [4, 'valid', 0],
    [4, 'valid', 0],
    [4, 'valid', 0],
    [4, 'valid', 0],
    [4, 'valid', 0],
    [4, 'valid', 0],
    [4, 'error', 3],
    [4, 'valid', 0],
    [4, 'invalid', 1],
  ]);
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
