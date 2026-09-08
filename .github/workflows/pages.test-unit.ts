// @vitest-environment node
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';

import { parse } from 'yaml';
import { expect, test } from 'vitest';

// only the workflow and cache fields that define deployment input coverage
interface IPagesWorkflow {
  on: { push: { branches: string[]; paths: string[] }; workflow_dispatch: unknown };
}
interface ITurboConfiguration {
  tasks: Record<string, { inputs?: string[] }>;
}

const repositoryRoot = new URL('../../', import.meta.url);
const workflow = parse(
  readFileSync(new URL('pages.yml', import.meta.url), 'utf8'),
) as IPagesWorkflow;
const turbo = JSON.parse(
  readFileSync(new URL('turbo.json', repositoryRoot), 'utf8'),
) as ITurboConfiguration;
const buildInputs = turbo.tasks['@moldea.ai/packages-website#build']?.inputs ?? [];

test('retains main-only automatic deployment and manual dispatch', () => {
  expect(workflow.on.push.branches).toStrictEqual(['main']);
  expect(workflow.on).toHaveProperty('workflow_dispatch');
});

test.each([
  'specifications/repository-format.md',
  'packages/adapter-static-analysis/src/index.ts',
  'projects/website-ui/src/components/dialog/dialog.component.astro',
  'apps/website/content/getting-started.md',
  'compatibility/runtimes.yaml',
])('deploys when %s changes alone', (sourcePath) => {
  expect(workflow.on.push.paths.some((pattern) => posix.matchesGlob(sourcePath, pattern))).toBe(
    true,
  );
});

test('covers every repository-level website build input with a deployment trigger', () => {
  expect(buildInputs.length).toBeGreaterThan(0);
  const externalInputs = buildInputs
    .filter((input) => input.startsWith('$TURBO_ROOT$/'))
    .map((input) => input.slice('$TURBO_ROOT$/'.length));
  expect(externalInputs.length).toBeGreaterThan(0);
  for (const input of externalInputs) {
    // Exact patterns or a whole-directory trigger cover every path matched by a build input.
    expect(
      workflow.on.push.paths.some(
        (pattern) =>
          pattern === input || (pattern.endsWith('/**') && input.startsWith(pattern.slice(0, -2))),
      ),
      `Missing deployment trigger for ${input}`,
    ).toBe(true);
  }
});
