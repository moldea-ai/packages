// @vitest-environment node
import { expect, test } from 'vitest';

import {
  getGitHead,
  loadGitWorkspaceSnapshot,
  type IWorkspacePackageState,
} from '../workspace-graph/index.ts';

import {
  CI_COMPATIBILITY_LANES,
  createCiPlan,
  parseCiPlan,
  validateCiJobResults,
  validateCiWorkspaceSelection,
} from './index.ts';

const root = new URL('../../', import.meta.url);
const commit = getGitHead(root);
const current = loadGitWorkspaceSnapshot(root, commit);
const select = (changedPaths: string[]) =>
  createCiPlan({
    testedCommit: commit,
    comparisonCommit: commit,
    current,
    previous: current,
    changedPaths,
  });

test.each([
  ['apps/website/src/pages/capabilities/index.astro', ['@moldea.ai/packages-website']],
  ['specifications/repository-format.md', ['@moldea.ai/packages-website']],
  [
    'projects/website-ui/src/example.test-unit.ts',
    ['@moldea.ai/packages-website', '@moldea.ai/website-ui'],
  ],
  [
    'projects/adapter-openai/src/example.test-integration.ts',
    ['@moldea.ai/adapter-openai', '@moldea.ai/cli', '@moldea.ai/packages-website'],
  ],
  ['projects/cli/src/example.ts', ['@moldea.ai/cli', '@moldea.ai/packages-website']],
  [
    'projects/repository-fs/src/example.ts',
    ['@moldea.ai/cli', '@moldea.ai/packages-website', '@moldea.ai/repository-fs'],
  ],
])('createCiPlan(%s) selects the owner and transitive consumers', (path, names) => {
  const plan = select([path]);
  expect(plan.workspaces).toStrictEqual(names);
  expect(plan.mode).toBe('affected');
  expect(parseCiPlan(JSON.stringify(plan))).toStrictEqual(plan);
});

test.each([
  'projects/repository/src/a.ts',
  'projects/core/src/a.test-unit.ts',
  'packages/adapter-static-analysis/src/a.ts',
])('createCiPlan(%s) preserves foundational and private fan-out', (path) => {
  const plan = select([path]);
  expect(plan.workspaces).toContain('@moldea.ai/cli');
  expect(plan.workspaces).toContain('@moldea.ai/packages-website');
  expect(plan.workspaces).toContain('@moldea.ai/adapter-openai');
  expect(plan.rootIntegration).toBe(true);
  expect(plan.artifacts).toBe(true);
});

test.each([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'turbo.json',
  'fixtures/example.json',
  'configs/vite/example.ts',
  '.github/workflows/ci.yml',
  'scripts/ci/run.ts',
  'compatibility/runtimes.yaml',
  'scripts/runtime-compatibility/check.ts',
  'docs/runtime-compatibility.md',
  'unknown/input.ts',
])('createCiPlan(%s) conservatively selects full verification', (path) => {
  expect(select([path])).toMatchObject({
    mode: 'full',
    workspaces: [...current.keys()].sort(),
    rootIntegration: true,
    lanes: CI_COMPATIBILITY_LANES,
    artifacts: true,
  });
});

test.each([[[]], [['projects/core/_archive/package.json']], [['apps/website/_backup/page.ts']]])(
  'createCiPlan(%o) retains cheap checks without selecting package tasks',
  (paths) => {
    expect(select(paths)).toMatchObject({
      mode: 'affected',
      workspaces: [],
      lanes: [],
      rootIntegration: false,
      artifacts: false,
    });
  },
);

test('union edges carry removed dependencies and renamed/deleted owners to current consumers', () => {
  const workspace = (
    name: string,
    directory: string,
    workspaceDependencies: string[] = [],
  ): IWorkspacePackageState => ({
    name,
    directory,
    workspaceDependencies,
    isPrivate: true,
    scripts: [],
  });
  const previous = new Map([
    ['old', workspace('old', 'packages/old')],
    ['consumer', workspace('consumer', 'apps/consumer', ['old'])],
  ]);
  const next = new Map([
    ['replacement', workspace('replacement', 'packages/new')],
    ['consumer', workspace('consumer', 'apps/consumer', ['replacement'])],
    ['downstream', workspace('downstream', 'apps/downstream', ['consumer'])],
  ]);
  const plan = createCiPlan({
    testedCommit: commit,
    comparisonCommit: commit,
    previous,
    current: next,
    changedPaths: ['packages/old/src/a.ts', 'packages/new/src/a.ts'],
  });
  expect(plan.workspaces).toStrictEqual(['consumer', 'downstream', 'replacement']);
  validateCiWorkspaceSelection(plan, next);
  expect(() => validateCiWorkspaceSelection(plan, new Map())).toThrow('workspace inventory');
});

test('missing comparison and forced release plans select full verification', () => {
  for (const options of [
    { comparisonCommit: null },
    { comparisonCommit: commit, fullReason: 'Release candidates require complete verification.' },
  ]) {
    expect(
      createCiPlan({
        testedCommit: commit,
        current,
        previous: current,
        changedPaths: [],
        ...options,
      }),
    ).toMatchObject({
      mode: 'full',
      workspaces: [...current.keys()].sort(),
      lanes: CI_COMPATIBILITY_LANES,
    });
  }
});

test.each([
  { artifacts: true },
  { rootIntegration: true },
  { mode: 'unknown' },
  { extra: true },
  { testedCommit: 'HEAD' },
  { comparisonCommit: null },
  { workspaces: ['z', 'a'] },
  { workspaces: ['x', 'x'] },
  { lanes: ['unknown'] },
  { reasons: [] },
])('parseCiPlan rejects inconsistent or malformed fields %o', (override) => {
  expect(() => parseCiPlan(JSON.stringify({ ...select([]), ...override }))).toThrow();
});

test.each(['success', 'skipped', 'failure', 'cancelled'])(
  'final gate enforces the selected job result (%s)',
  (result) => {
    const plan = select(['projects/adapter-openai/src/a.ts']);
    const results = Object.fromEntries(
      ['plan', 'checks', ...CI_COMPATIBILITY_LANES, 'test-cross-platform'].map((name) => [
        name,
        {
          result: ['plan', 'checks', 'test-cross-platform', ...plan.lanes].includes(name)
            ? 'success'
            : 'skipped',
        },
      ]),
    );
    results['cli-runtime-compatibility'] = { result };
    if (result === 'success')
      expect(() => validateCiJobResults(plan, JSON.stringify(results))).not.toThrow();
    else
      expect(() => validateCiJobResults(plan, JSON.stringify(results))).toThrow(
        'cli-runtime-compatibility',
      );
  },
);

test('final gate rejects planner failure and missing/malformed results; permits only unselected skips', () => {
  const plan = select([]);
  const results = Object.fromEntries(
    ['plan', 'checks', ...CI_COMPATIBILITY_LANES, 'test-cross-platform'].map((name) => [
      name,
      { result: ['plan', 'checks'].includes(name) ? 'success' : 'skipped' },
    ]),
  );
  expect(() => validateCiJobResults(plan, JSON.stringify(results))).not.toThrow();
  expect(() => validateCiJobResults(plan, '{}')).toThrow('incomplete');
  expect(() =>
    validateCiJobResults(plan, JSON.stringify({ ...results, plan: { result: 'failure' } })),
  ).toThrow('plan');
  expect(() => validateCiJobResults(plan, JSON.stringify({ ...results, checks: null }))).toThrow(
    'incomplete',
  );
  expect(() =>
    validateCiJobResults(
      plan,
      JSON.stringify({ ...results, 'cli-runtime-compatibility': { result: 'success' } }),
    ),
  ).toThrow('skipped');
});

test('large mixed path sets produce a bounded deterministic explanation without losing selection', () => {
  const paths = Array.from({ length: 4096 }, (_, index) => `scripts/input-${index}.ts`);
  const plan = select(paths);
  expect(plan.reasons).toStrictEqual(['Global or unknown input: scripts/input-0.ts']);
  expect(select(paths.reverse())).toStrictEqual(plan);
  expect(plan.workspaces).toStrictEqual([...current.keys()].sort());
});

test('mixed adapter and website changes deduplicate consumers without enabling unrelated lanes', () => {
  const plan = select([
    'apps/website/page.astro',
    'projects/adapter-openai/test.test-unit.ts',
    'projects/adapter-anthropic/src/a.ts',
  ]);
  expect(plan.workspaces).toStrictEqual([
    '@moldea.ai/adapter-anthropic',
    '@moldea.ai/adapter-openai',
    '@moldea.ai/cli',
    '@moldea.ai/packages-website',
  ]);
  expect(plan.lanes).toStrictEqual([
    'consumer-conformance',
    'cli-testing-peer-compatibility',
    'cli-runtime-compatibility',
    'adapter-anthropic-runtime-compatibility',
    'adapter-openai-runtime-compatibility',
  ]);
});

test.each([
  ['projects/repository/src/a.ts', ['@moldea.ai/website-ui', '@moldea.ai/adapter-static-analysis']],
  [
    'projects/core/src/a.ts',
    [
      '@moldea.ai/website-ui',
      '@moldea.ai/adapter-static-analysis',
      '@moldea.ai/repository',
      '@moldea.ai/repository-fs',
    ],
  ],
  [
    'packages/adapter-static-analysis/src/a.ts',
    [
      '@moldea.ai/website-ui',
      '@moldea.ai/core',
      '@moldea.ai/repository',
      '@moldea.ai/repository-fs',
    ],
  ],
])(
  'foundational selection (%s) excludes packages outside its downstream graph',
  (path, excluded) => {
    expect(select([path]).workspaces).toStrictEqual(
      [...current.keys()].filter((name) => !excluded.includes(name)).sort(),
    );
  },
);

test.each([
  '*',
  '!@moldea.ai/core',
  '@moldea.ai/*',
  '...consumer',
  'consumer...',
  '@moldea.ai/consumer...',
  './projects/core',
  'consumer[1]',
])('plan rejects Turbo filter expressions in workspace names (%s)', (name) => {
  expect(() =>
    parseCiPlan(JSON.stringify({ ...select([]), workspaces: [name], rootIntegration: true })),
  ).toThrow('CI plan is invalid');
});
