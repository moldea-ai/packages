// @vitest-environment node
import { access, readFile, symlink } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'vitest';

import { resolveFixturePath, withFixtureWorkspace } from './fixture-workspace.ts';

test('contains writes and removes the complete disposable workspace on success', async () => {
  const directory = await withFixtureWorkspace(
    [{ path: '/policy.md', content: '30 days\n' }],
    async (workspace) => {
      await workspace.write({ path: '/context/returns.md', content: 'Return policy\n' });
      expect(await readFile(resolveFixturePath(workspace.directory, '/policy.md'), 'utf8')).toBe(
        '30 days\n',
      );
      expect(
        await readFile(resolveFixturePath(workspace.directory, '/context/returns.md'), 'utf8'),
      ).toBe('Return policy\n');
      return workspace.directory;
    },
  );
  await expect(access(directory)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('cleans up after the operation fails and preserves that failure', async () => {
  let directory = '';
  const failure = new Error('Synthetic operation failed.');
  await expect(
    withFixtureWorkspace([], (workspace) => {
      directory = workspace.directory;
      return Promise.reject(failure);
    }),
  ).rejects.toBe(failure);
  expect(directory).not.toBe('');
  await expect(access(directory)).rejects.toMatchObject({ code: 'ENOENT' });
});

test.each([
  '',
  '/',
  '../policy.md',
  '/../../policy.md',
  '/a/../policy.md',
  '/a//policy.md',
  '/a/./policy.md',
  '/C:/policy.md',
  '/a\\policy.md',
  '//server/share/policy.md',
  '/con',
  '/lpt1.txt',
  '/aux.md',
  '/Policy.md',
  '/policy.',
  '/policy .md',
  '/_archive/policy.md',
  '/_archives/policy.md',
  '/_backup/policy.md',
  '/_backups/policy.md',
  `/${'a'.repeat(65)}`,
  `/${'a'.repeat(63)}/${'b'.repeat(63)}/${'c'.repeat(63)}`,
])('resolveFixturePath(%s) -> unsafe path', (logicalPath) => {
  expect(() => resolveFixturePath(path.resolve('fixture-root'), logicalPath)).toThrow(
    'fixture path is unsafe',
  );
});

test('accepts portable logical names with native host separators', () => {
  const root = path.resolve('fixture-root');
  expect(resolveFixturePath(root, '/context/returns-policy.md')).toBe(
    path.join(root, 'context', 'returns-policy.md'),
  );
});

test.skipIf(process.platform === 'win32')(
  'refuses symlink parents and leaves the other workspace untouched',
  async () => {
    await withFixtureWorkspace(
      [{ path: '/policy.md', content: 'Protected\n' }],
      async (outside) => {
        await withFixtureWorkspace([], async (inside) => {
          await symlink(outside.directory, path.join(inside.directory, 'linked'), 'dir');
          await expect(
            inside.write({ path: '/linked/policy.md', content: 'Changed\n' }),
          ).rejects.toThrow('fixture path is unsafe');
          expect(await readFile(path.join(outside.directory, 'policy.md'), 'utf8')).toBe(
            'Protected\n',
          );
        });
      },
    );
  },
);
