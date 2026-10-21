// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { expectToRejectCode } from 'jg-exception/testing';

import type { IRepositoryLinkResolution } from './contracts.js';
import {
  REPOSITORY_LINK_MAX_HOPS,
  resolveRepositoryLink,
  type IRepositoryLinkSource,
} from './links.js';
import { createMemoryRepositoryReader, type IMemoryRepositoryEntry } from './memory.js';
import { parseRepositoryPath } from './repository-path.js';

const BASE_ENTRIES: readonly IMemoryRepositoryEntry[] = [
  { content: '# Agents\n', path: '/AGENTS.md', type: 'file' },
  { content: '# Docs\n', path: '/docs/guide.md', type: 'file' },
  { path: '/empty', type: 'directory' },
];

const resolveIn = (
  entries: readonly IMemoryRepositoryEntry[],
  path: string,
): Promise<IRepositoryLinkResolution> =>
  resolveRepositoryLink(
    createMemoryRepositoryReader([...BASE_ENTRIES, ...entries]),
    parseRepositoryPath(path),
  );

/** Builds a chain of links `/chain-1` to `/chain-<count>` whose last link names `/AGENTS.md`. */
const createChain = (count: number): IMemoryRepositoryEntry[] =>
  Array.from({ length: count }, (_value, index) => ({
    path: `/chain-${index + 1}`,
    target: index + 1 === count ? 'AGENTS.md' : `chain-${index + 2}`,
    type: 'symlink' as const,
  }));

describe('resolveRepositoryLink', () => {
  test('resolveRepositoryLink(regular file) -> its own path', async () => {
    await expect(resolveIn([], '/AGENTS.md')).resolves.toStrictEqual({
      state: 'file',
      targetPath: '/AGENTS.md',
    });
  });

  test.each([
    ['/CLAUDE.md', 'AGENTS.md', '/AGENTS.md'],
    ['/CLAUDE.md', './AGENTS.md', '/AGENTS.md'],
    ['/CLAUDE.md', 'docs//guide.md', '/docs/guide.md'],
    ['/CLAUDE.md', 'docs/./guide.md', '/docs/guide.md'],
    ['/docs/AGENTS.md', '../AGENTS.md', '/AGENTS.md'],
    ['/.claude/CLAUDE.md', '.././../AGENTS.md', null],
    ['/a/b/AGENTS.md', '../../docs/guide.md', '/docs/guide.md'],
  ])('resolveRepositoryLink(%s -> %s) -> %s', async (linkPath, target, expectedPath) => {
    const resolution = await resolveIn([{ path: linkPath, target, type: 'symlink' }], linkPath);

    expect(resolution).toStrictEqual(
      expectedPath === null ? { state: 'outside' } : { state: 'file', targetPath: expectedPath },
    );
  });

  test.each([
    ['../AGENTS.md', 'outside'],
    ['/AGENTS.md', 'outside'],
    ['/etc/passwd', 'outside'],
    ['//server/share/AGENTS.md', 'outside'],
    ['C:/Users/AGENTS.md', 'outside'],
    ['c:\\Users\\AGENTS.md', 'outside'],
    ['docs/../AGENTS.md', 'unsupported'],
    ['docs/guide.md/', 'unsupported'],
    ['docs\\guide.md', 'unsupported'],
    ['', 'unsupported'],
    ['missing.md', 'missing'],
    ['docs/missing/guide.md', 'missing'],
    ['empty', 'not-file'],
    ['docs', 'not-file'],
    ['.', 'not-file'],
  ])('resolveRepositoryLink(/CLAUDE.md -> %s) -> %s', async (target, state) => {
    await expect(
      resolveIn([{ path: '/CLAUDE.md', target, type: 'symlink' }], '/CLAUDE.md'),
    ).resolves.toStrictEqual({ state });
  });

  test('resolveRepositoryLink(link over 4096 UTF-8 bytes) -> unsupported', async () => {
    await expect(
      resolveIn(
        [{ path: '/CLAUDE.md', target: `${'a'.repeat(4096)}b`, type: 'symlink' }],
        '/CLAUDE.md',
      ),
    ).resolves.toStrictEqual({ state: 'unsupported' });
  });

  test.each([
    ['missing path', '/missing.md', 'missing'],
    ['directory', '/empty', 'not-file'],
  ])('resolveRepositoryLink(%s) -> %s', async (_name, path, state) => {
    await expect(resolveIn([], path)).resolves.toStrictEqual({ state });
  });

  test('resolveRepositoryLink(chain of links) -> the final file', async () => {
    await expect(
      resolveIn(
        [
          { path: '/CLAUDE.md', target: '.claude/CLAUDE.md', type: 'symlink' },
          { path: '/.claude/CLAUDE.md', target: '../docs/AGENTS.md', type: 'symlink' },
          { path: '/docs/AGENTS.md', target: '../AGENTS.md', type: 'symlink' },
        ],
        '/CLAUDE.md',
      ),
    ).resolves.toStrictEqual({ state: 'file', targetPath: '/AGENTS.md' });
  });

  test.each([
    ['self', [{ path: '/CLAUDE.md', target: 'CLAUDE.md', type: 'symlink' as const }]],
    [
      'pair',
      [
        { path: '/CLAUDE.md', target: 'AGENTS.local.md', type: 'symlink' as const },
        { path: '/AGENTS.local.md', target: 'CLAUDE.md', type: 'symlink' as const },
      ],
    ],
  ])('resolveRepositoryLink(%s loop) -> loop', async (_name, entries) => {
    await expect(resolveIn(entries, '/CLAUDE.md')).resolves.toStrictEqual({ state: 'loop' });
  });

  test('resolveRepositoryLink(32 links) -> file, and 33 links -> loop', async () => {
    expect(REPOSITORY_LINK_MAX_HOPS).toBe(32);
    await expect(resolveIn(createChain(32), '/chain-1')).resolves.toStrictEqual({
      state: 'file',
      targetPath: '/AGENTS.md',
    });
    await expect(resolveIn(createChain(33), '/chain-1')).resolves.toStrictEqual({
      state: 'loop',
    });
  });

  test('costs one lookup and one link-text read per link, and reads nothing else', async () => {
    const reader = createMemoryRepositoryReader([...BASE_ENTRIES, ...createChain(3)]);
    const lookups: string[] = [];
    const linkReads: string[] = [];
    const source: IRepositoryLinkSource = {
      getEntry: (path, options) => {
        lookups.push(path);

        return reader.getEntry(path, options);
      },
      readLinkText: (path, options) => {
        linkReads.push(path);

        return reader.readLinkText(path, options);
      },
    };

    await expect(
      resolveRepositoryLink(source, parseRepositoryPath('/chain-1')),
    ).resolves.toStrictEqual({ state: 'file', targetPath: '/AGENTS.md' });
    expect(lookups).toStrictEqual(['/chain-1', '/chain-2', '/chain-3', '/AGENTS.md']);
    expect(linkReads).toStrictEqual(['/chain-1', '/chain-2', '/chain-3']);
  });

  test('stops reading after a link that leaves the repository', async () => {
    const reader = createMemoryRepositoryReader([
      ...BASE_ENTRIES,
      { path: '/CLAUDE.md', target: '../../outside/AGENTS.md', type: 'symlink' },
    ]);
    const lookups: string[] = [];
    const source: IRepositoryLinkSource = {
      getEntry: (path, options) => {
        lookups.push(path);

        return reader.getEntry(path, options);
      },
      readLinkText: (path, options) => reader.readLinkText(path, options),
    };

    await expect(
      resolveRepositoryLink(source, parseRepositoryPath('/CLAUDE.md')),
    ).resolves.toStrictEqual({ state: 'outside' });
    expect(lookups).toStrictEqual(['/CLAUDE.md']);
  });

  test('rejects forged paths and propagates cancellation', async () => {
    const reader = createMemoryRepositoryReader(BASE_ENTRIES);
    const aborted = new AbortController();
    aborted.abort(new Error('cancelled by test'));

    await expectToRejectCode(
      resolveRepositoryLink(reader, '../AGENTS.md' as never),
      'INVALID_REPOSITORY_PATH',
    );
    await expectToRejectCode(
      resolveRepositoryLink(reader, parseRepositoryPath('/AGENTS.md'), { signal: aborted.signal }),
      'ABORTED',
    );
  });
});
