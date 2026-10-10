// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, expect, test } from 'vitest';

import {
  getGitHead,
  hasGitCommit,
  listGitChangedPaths,
  loadGitWorkspaceSnapshot,
  readGitFile,
  readOptionalGitFile,
} from './index.ts';

let directory: string;
const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
const root = () => pathToFileURL(`${directory}${sep}`);
const write = async (path: string, source: string) => {
  await mkdir(dirname(join(directory, path)), { recursive: true });
  await writeFile(join(directory, path), source);
  git('add', '--', path);
};
const manifest = async (path: string, name: string, dependencies: Record<string, string> = {}) =>
  write(`${path}/package.json`, JSON.stringify({ name, private: true, dependencies }));
const commit = () => {
  git('commit', '--quiet', '--no-gpg-sign', '-m', 'fixture');
  return getGitHead(root());
};

beforeEach(async () => {
  directory = join(tmpdir(), `moldea-graph-${randomUUID()}`);
  await mkdir(directory);
  git('init', '--quiet');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.com');
  git('config', 'core.hooksPath', join(directory, 'no-hooks'));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

test('committed discovery ignores excluded tree entries and reads no worktree substitutions', async () => {
  await manifest('packages/a', 'a');
  await write('README.md', 'fixture');
  const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], {
    cwd: directory,
    input: 'invalid manifest',
    encoding: 'utf8',
  }).trim();
  for (const excluded of ['_archive', '_archives', '_backup', '_backups'])
    git('update-index', '--add', '--cacheinfo', `100644,${blob},packages/${excluded}/package.json`);
  const head = commit();
  await writeFile(join(directory, 'packages/a/package.json'), 'invalid worktree JSON');
  expect([...loadGitWorkspaceSnapshot(root(), head).keys()]).toStrictEqual(['a']);
  expect(readGitFile(root(), head, 'README.md')).toBe('fixture');
  expect(readOptionalGitFile(root(), head, 'absent.json')).toBeNull();
  for (const path of [
    '../README.md',
    '/README.md',
    'C:README.md',
    'a\\b',
    'packages/_archive/package.json',
  ])
    expect(() => readGitFile(root(), head, path)).toThrow('invalid or excluded');
  expect(() => readGitFile(root(), 'HEAD', 'README.md')).toThrow('commit is invalid');
  expect(hasGitCommit(root(), head)).toBe(true);
  expect(hasGitCommit(root(), 'f'.repeat(40))).toBe(false);
});

test('path metadata preserves both sides of moves and deletions with old and current edges', async () => {
  await manifest('packages/old', 'dependency');
  await manifest('apps/consumer', 'consumer', { dependency: 'workspace:*' });
  const base = commit();
  await rename(join(directory, 'packages/old'), join(directory, 'packages/new'));
  git('add', '--', 'packages/old', 'packages/new');
  await manifest('apps/consumer', 'consumer');
  const head = commit();
  expect(listGitChangedPaths(root(), base, head)).toStrictEqual([
    'apps/consumer/package.json',
    'packages/new/package.json',
    'packages/old/package.json',
  ]);
  expect(
    loadGitWorkspaceSnapshot(root(), base).get('consumer')?.workspaceDependencies,
  ).toStrictEqual(['dependency']);
  expect(
    loadGitWorkspaceSnapshot(root(), head).get('consumer')?.workspaceDependencies,
  ).toStrictEqual([]);
});

test.each(['duplicate', 'missing', 'cycle', 'invalid'])(
  'invalid committed graph (%s) fails explicitly',
  async (kind) => {
    if (kind === 'duplicate') {
      await manifest('packages/a', 'a');
      await manifest('packages/b', 'a');
    }
    if (kind === 'missing') await manifest('packages/a', 'a', { missing: 'workspace:*' });
    if (kind === 'cycle') {
      await manifest('packages/a', 'a', { b: 'workspace:*' });
      await manifest('packages/b', 'b', { a: 'workspace:*' });
    }
    if (kind === 'invalid') await write('packages/a/package.json', '{');
    const head = commit();
    expect(() => loadGitWorkspaceSnapshot(root(), head)).toThrow();
  },
);
