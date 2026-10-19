// @vitest-environment node
import { execFileSync } from 'node:child_process';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import fsPromises from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  RepositorySourceException,
  parseRepositoryPath,
  type IRepositoryLinkResolver,
  type IRepositoryPath,
} from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';
import { describeRepositoryLinkResolverConformance } from '@moldea.ai/repository/testing';
import { afterAll, describe, expect, test, vi } from 'vitest';
import { expectToThrowCode } from 'web-utils-kit';

import { createFilesystemRepositoryReader } from '../reader/index.js';

import { MAX_LINK_HOPS } from './constants.js';
import { createFilesystemRepositoryLinkResolver } from './link-resolver.js';

const isWindows = process.platform === 'win32';
const encoder = new TextEncoder();
const MAX_READ_BYTES = 64;
const temporaryDirectory = await realpath(await mkdtemp(path.join(tmpdir(), 'moldea-links-')));
const cleanupTasks: (() => Promise<void>)[] = [];

afterAll(async () => {
  for (const task of cleanupTasks.reverse()) {
    await task();
  }

  await rm(temporaryDirectory, { force: true, recursive: true });
});

const writeText = async (filePath: string, text: string): Promise<Uint8Array> => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, text);

  return encoder.encode(text);
};

// creates a real link; Windows needs the target kind, and fails clearly without the privilege
const link = async (
  target: string,
  linkPath: string,
  kind: 'dir' | 'file' | 'junction' = 'file',
): Promise<void> => {
  await mkdir(path.dirname(linkPath), { recursive: true });
  await symlink(target, linkPath, isWindows ? kind : undefined);
};

const createResolver = async (rootDirectory: string): Promise<IRepositoryLinkResolver> => {
  const reader = await createFilesystemRepositoryReader({
    limits: { maxReadBytes: MAX_READ_BYTES },
    rootDirectory,
    selection: { kind: 'directory' },
  });

  return createFilesystemRepositoryLinkResolver(reader);
};

/*
 * The OS oracle: the file the operating system opens through the link. Inside results compare
 * device and inode at the logical target; outside results compare the bytes read through the
 * resolver with the bytes the OS reads through the link. JavaScript `fs.realpath` is never used
 * because it collapses `..` textually.
 */
const getOracle = async (
  rootDirectory: string,
  logicalPath: string,
): Promise<{
  readonly bytes: Uint8Array;
  readonly isInside: boolean;
  readonly targetPath: string;
}> => {
  const hostPath = path.join(rootDirectory, ...logicalPath.slice(1).split('/'));
  const target = await realpath(hostPath);
  const relative = path.relative(rootDirectory, target);
  const isInside =
    relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);

  return {
    bytes: new Uint8Array(await readFile(hostPath)),
    isInside,
    targetPath: `/${relative.split(path.sep).join('/')}`,
  };
};

const expectSameInode = async (
  rootDirectory: string,
  linkPath: string,
  targetPath: string,
): Promise<void> => {
  const throughLink = await stat(path.join(rootDirectory, ...linkPath.slice(1).split('/')), {
    bigint: true,
  });
  const atTarget = await lstat(path.join(rootDirectory, ...targetPath.slice(1).split('/')), {
    bigint: true,
  });

  expect([atTarget.dev, atTarget.ino]).toStrictEqual([throughLink.dev, throughLink.ino]);
};

// the primary layout covering every resolution state the host can express
const rootDirectory = path.join(temporaryDirectory, 'repository');
const outsideDirectory = path.join(temporaryDirectory, 'outside');
const insideBytes = await writeText(
  path.join(rootDirectory, 'docs', 'AGENTS.md'),
  'inside target\n',
);
await writeText(path.join(rootDirectory, 'file.txt'), 'plain\n');
await mkdir(path.join(rootDirectory, 'dir'), { recursive: true });
const outsideBytes = await writeText(path.join(outsideDirectory, 'shared.md'), 'outside shared\n');
const otherOutsideBytes = await writeText(
  path.join(outsideDirectory, 'other.md'),
  'outside other\n',
);
await link('docs/AGENTS.md', path.join(rootDirectory, 'inside-file'));
await link('hop-2', path.join(rootDirectory, 'hop-1'));
await link('docs/AGENTS.md', path.join(rootDirectory, 'hop-2'));
await link('docs', path.join(rootDirectory, 'inside-directory'), 'dir');
await link(path.join('..', 'outside', 'shared.md'), path.join(rootDirectory, 'outside-file'));
await link(path.join(outsideDirectory, 'shared.md'), path.join(rootDirectory, 'outside-alias'));
await link(path.join('..', 'outside', 'other.md'), path.join(rootDirectory, 'outside-other'));
await link(path.join('..', 'outside'), path.join(rootDirectory, 'outside-directory'), 'dir');
await link('missing.md', path.join(rootDirectory, 'broken'));
await link('docs/missing.md', path.join(rootDirectory, 'broken-nested'));
await link('file.txt/child', path.join(rootDirectory, 'broken-through-file'));
await link('loop-b', path.join(rootDirectory, 'loop-a'));
await link('loop-a', path.join(rootDirectory, 'loop-b'));
await link('self-loop', path.join(rootDirectory, 'self-loop'));

// parent segments after a directory link: the OS decides which file this reaches
await writeText(path.join(rootDirectory, 'lexical-target.md'), 'reached textually\n');
await writeText(path.join(rootDirectory, 'nested', 'lexical-target.md'), 'reached physically\n');
await mkdir(path.join(rootDirectory, 'nested', 'deep'), { recursive: true });
await link(path.join('nested', 'deep'), path.join(rootDirectory, 'jump'), 'dir');
await link('jump/../lexical-target.md', path.join(rootDirectory, 'parent-inside'));
await writeText(path.join(temporaryDirectory, 'elsewhere', 'x.md'), 'outside textually\n');
await writeText(path.join(outsideDirectory, 'elsewhere', 'x.md'), 'outside physically\n');
await mkdir(path.join(outsideDirectory, 'a', 'b'), { recursive: true });
await link(path.join(outsideDirectory, 'a', 'b'), path.join(rootDirectory, 'jump-out'), 'dir');
await link('jump-out/../../elsewhere/x.md', path.join(rootDirectory, 'parent-outside'));

// refused targets: none of these may reach the filesystem beneath the refused path
const deepPrefix = '../'.repeat(24);
const unsafeLinks: Record<string, string> = {
  'unsafe-drive-relative': 'C:AGENTS.md',
  'unsafe-net': '/net/host/share/AGENTS.md',
  'unsafe-network': '/Network/Servers/host/AGENTS.md',
  'unsafe-unc': isWindows ? '\\\\server\\share\\AGENTS.md' : '//server/share/AGENTS.md',
  'unsafe-unc-device': '\\\\?\\UNC\\server\\share\\AGENTS.md',
  'unsafe-intermediate': 'net-host/share/AGENTS.md',
  ...(isWindows
    ? {}
    : {
        'unsafe-deep-net': `${deepPrefix}net/host/share/AGENTS.md`,
        'unsafe-deep-network': `${deepPrefix}Network/Servers/host/AGENTS.md`,
      }),
};
await link('/net/host', path.join(rootDirectory, 'net-host'), 'dir');

for (const [name, target] of Object.entries(unsafeLinks)) {
  await link(target, path.join(rootDirectory, name));
}

// denial and special files are POSIX host features; Windows supplies none
const canDeny = !isWindows && process.getuid?.() !== 0;
const otherTargetLinkPaths: string[] = [];

if (canDeny) {
  await writeText(path.join(rootDirectory, 'locked', 'AGENTS.md'), 'locked\n');
  await link('locked/AGENTS.md', path.join(rootDirectory, 'denied'));
  await chmod(path.join(rootDirectory, 'locked'), 0o000);
  cleanupTasks.push(async () => chmod(path.join(rootDirectory, 'locked'), 0o700));
}

if (!isWindows) {
  execFileSync('mkfifo', [path.join(rootDirectory, 'pipe')]);
  await link('pipe', path.join(rootDirectory, 'pipe-link'));
  otherTargetLinkPaths.push('/pipe-link');
}

const parentInsideOracle = await getOracle(rootDirectory, '/parent-inside');
const parentOutsideOracle = await getOracle(rootDirectory, '/parent-outside');
const hostPathFragments = [temporaryDirectory, await realpath(tmpdir()), tmpdir()].flatMap(
  (fragment) => [fragment, JSON.stringify(fragment).slice(1, -1)],
);

// one resolver whose link target is replaced, and one whose root is replaced
const createMutationRoot = async (name: string): Promise<string> => {
  const directory = path.join(temporaryDirectory, name);
  await writeText(path.join(directory, 'target.md'), 'before\n');
  await link('target.md', path.join(directory, 'AGENTS.md'));

  return directory;
};

describeRepositoryLinkResolverConformance('filesystem', {
  brokenLinkPaths: ['/broken', '/broken-nested', '/broken-through-file'],
  createResolver: () => createResolver(rootDirectory),
  createRootReplacementFixture: async () => {
    const directory = await createMutationRoot(`root-${String(Date.now())}`);
    const resolver = await createResolver(directory);

    return {
      linkPath: '/AGENTS.md',
      mutateSource: async () => {
        await rename(directory, `${directory}-old`);
        await createMutationRoot(path.basename(directory));
      },
      resolver,
    };
  },
  createTargetReplacementFixture: async () => {
    const directory = await createMutationRoot(`target-${String(Date.now())}`);
    const resolver = await createResolver(directory);

    return {
      linkPath: '/AGENTS.md',
      mutateSource: async () => {
        await writeText(path.join(directory, 'replacement.md'), 'after, longer\n');
        await rename(path.join(directory, 'replacement.md'), path.join(directory, 'target.md'));
      },
      resolver,
    };
  },
  deniedLinkPaths: canDeny ? ['/denied'] : [],
  hostPathFragments,
  insideDirectoryLink: { path: '/inside-directory', targetPath: '/docs' },
  insideFileLink: { bytes: insideBytes, path: '/inside-file', targetPath: '/docs/AGENTS.md' },
  isRepositorySourceException: (cause) => cause instanceof RepositorySourceException,
  loopLinkPaths: ['/loop-a', '/self-loop'],
  maxReadBytes: MAX_READ_BYTES,
  missingPath: '/missing.md',
  multiHopLink: { bytes: insideBytes, path: '/hop-1', targetPath: '/docs/AGENTS.md' },
  notLinkPaths: ['/file.txt', '/dir'],
  otherTargetLinkPaths,
  outsideDirectoryLinkPath: '/outside-directory',
  outsideFileAliasLinkPath: '/outside-alias',
  outsideFileLink: { bytes: outsideBytes, path: '/outside-file' },
  outsideOtherFileLink: { bytes: otherOutsideBytes, path: '/outside-other' },
  parentAfterDirectoryLinks: {
    inside: {
      bytes: parentInsideOracle.bytes,
      path: '/parent-inside',
      targetPath: parentInsideOracle.targetPath,
    },
    outside: { bytes: parentOutsideOracle.bytes, path: '/parent-outside' },
  },
  parsePath: parseRepositoryPath,
  unsafeLinkPaths: Object.keys(unsafeLinks).map((name) => `/${name}`),
});

describe('filesystem link resolver', () => {
  test('matches the file the operating system opens through every resolvable link', async () => {
    const resolver = await createResolver(rootDirectory);

    expect(parentInsideOracle.isInside).toBe(true);
    expect(parentOutsideOracle.isInside).toBe(false);

    for (const logicalPath of [
      '/inside-file',
      '/hop-1',
      '/parent-inside',
      '/outside-file',
      '/outside-alias',
      '/outside-other',
      '/parent-outside',
    ]) {
      const oracle = await getOracle(rootDirectory, logicalPath);
      const resolution = await resolver.resolveLink(parseRepositoryPath(logicalPath));
      const page = await resolver.readLinkTargetPage(parseRepositoryPath(logicalPath), {
        maxBytes: MAX_READ_BYTES,
        offset: 0,
      });

      expect(resolution.state).toBe(oracle.isInside ? 'inside' : 'outside');
      expect(page.bytes).toStrictEqual(oracle.bytes);

      if (resolution.state === 'inside') {
        expect(resolution.targetPath).toBe(oracle.targetPath);
        await expectSameInode(rootDirectory, logicalPath, resolution.targetPath);
      }
    }
  });

  test('makes no filesystem call beneath a refused network or device target', async () => {
    const resolver = await createResolver(rootDirectory);
    const observed: string[] = [];
    const record =
      <TArguments extends unknown[], TResult>(
        original: (...parameters: TArguments) => TResult,
      ): ((...parameters: TArguments) => TResult) =>
      (...parameters) => {
        observed.push(String(parameters[0]));

        return original(...parameters);
      };
    const originalLstat = fsPromises.lstat;
    const originalReadlink = fsPromises.readlink;
    const originalOpen = fsPromises.open;
    vi.spyOn(fsPromises, 'lstat').mockImplementation(record(originalLstat));
    vi.spyOn(fsPromises, 'readlink').mockImplementation(record(originalReadlink));
    vi.spyOn(fsPromises, 'open').mockImplementation(record(originalOpen));
    syncBuiltinESMExports();

    try {
      for (const name of Object.keys(unsafeLinks)) {
        await expect(resolver.resolveLink(parseRepositoryPath(`/${name}`))).resolves.toStrictEqual({
          state: 'unsafe',
        });
      }
    } finally {
      vi.restoreAllMocks();
      syncBuiltinESMExports();
    }

    const networkCalls = observed.filter((hostPath) =>
      /^(?:[\\/]{2}|[\\/](?:net|network)(?:[\\/]|$))/iu.test(hostPath),
    );

    expect(observed.length).toBeGreaterThan(0);
    expect(networkCalls).toStrictEqual([]);
  });

  test(`follows ${String(MAX_LINK_HOPS)} links and reports a longer chain as a loop`, async () => {
    const directory = path.join(temporaryDirectory, 'chains');
    await writeText(path.join(directory, 'target.md'), 'chained\n');

    for (let index = 1; index <= MAX_LINK_HOPS + 1; index += 1) {
      await link(
        index === MAX_LINK_HOPS + 1 ? 'target.md' : `c${String(index + 1)}`,
        path.join(directory, `c${String(index)}`),
      );
    }

    const resolver = await createResolver(directory);

    await expect(resolver.resolveLink(parseRepositoryPath('/c2'))).resolves.toMatchObject({
      state: 'inside',
      targetPath: '/target.md',
    });
    await expect(resolver.resolveLink(parseRepositoryPath('/c1'))).resolves.toStrictEqual({
      state: 'loop',
    });
  });

  test.runIf(isWindows)('resolves through a directory junction like the OS', async () => {
    const directory = path.join(temporaryDirectory, 'junctions');
    await writeText(path.join(directory, 'docs', 'AGENTS.md'), 'junction target\n');
    await link(path.join(directory, 'docs'), path.join(directory, 'junction'), 'junction');
    await link('junction\\AGENTS.md', path.join(directory, 'AGENTS.md'));
    const resolver = await createResolver(directory);

    await expect(resolver.resolveLink(parseRepositoryPath('/junction'))).resolves.toMatchObject({
      state: 'inside',
      targetPath: '/docs',
      targetType: 'directory',
    });
    await expect(resolver.resolveLink(parseRepositoryPath('/AGENTS.md'))).resolves.toMatchObject({
      state: 'inside',
      targetPath: '/docs/AGENTS.md',
    });
    await expectSameInode(directory, '/AGENTS.md', '/docs/AGENTS.md');
  });

  test('derives identities per resolver so they are meaningless across resolvers', async () => {
    const first = await createResolver(rootDirectory);
    const second = await createResolver(rootDirectory);
    const linkPath: IRepositoryPath = parseRepositoryPath('/outside-file');
    const firstResolution = await first.resolveLink(linkPath);
    const secondResolution = await second.resolveLink(linkPath);

    expect(firstResolution.state).toBe('outside');
    expect(secondResolution.state).toBe('outside');
    expect(firstResolution).not.toStrictEqual(secondResolution);
  });

  test('accepts only readers created by this package', () => {
    const reader = createMemoryRepositoryReader([
      { content: 'x', path: '/AGENTS.md', type: 'file' },
    ]);

    expectToThrowCode(() => createFilesystemRepositoryLinkResolver(reader), 'INVALID_SOURCE_DATA');
  });
});
