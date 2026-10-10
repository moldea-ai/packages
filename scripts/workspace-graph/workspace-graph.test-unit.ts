// @vitest-environment node
import { expect, test } from 'vitest';

import { readWorkspacePackageState } from './index.ts';

test('readWorkspacePackageState retains deduplicated runtime and development edges', () => {
  expect(
    readWorkspacePackageState(
      JSON.stringify({
        name: '@moldea.ai/example',
        private: true,
        dependencies: { z: 'workspace:*', external: '^1.0.0' },
        devDependencies: { a: 'workspace:^1.0.0', z: 'workspace:*' },
        scripts: { build: 'tsc', 'test:unit': 'vitest' },
      }),
      'packages/example/package.json',
    ),
  ).toStrictEqual({
    name: '@moldea.ai/example',
    directory: 'packages/example',
    isPrivate: true,
    workspaceDependencies: ['a', 'z'],
    scripts: ['build', 'test:unit'],
  });
});

test.each([
  null,
  [],
  {},
  { name: '' },
  { name: 'x', private: 1 },
  { name: 'x', dependencies: [] },
  { name: 'x', dependencies: { y: null } },
  { name: 'x', devDependencies: 'invalid' },
  { name: 'x', scripts: [] },
  { name: 'x', scripts: { build: 1 } },
])('readWorkspacePackageState(%o) rejects malformed workspace facts', (manifest) => {
  expect(() =>
    readWorkspacePackageState(JSON.stringify(manifest), 'projects/x/package.json'),
  ).toThrow();
});
