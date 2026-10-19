import { describe, expect, test } from 'vitest';
import { expectToRejectCode } from 'web-utils-kit';

import type {
  IRepositoryLinkResolverConformanceFixture,
  IRepositoryLinkResolverConformanceResolution,
  IRepositoryLinkResolverConformanceResolver,
} from './types.js';

const readAllTargetBytes = async <TPath extends string>(
  resolver: IRepositoryLinkResolverConformanceResolver<TPath>,
  path: TPath,
): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = [];
  let offset: number | null = 0;
  let totalBytes = 0;

  while (offset !== null) {
    const page = await resolver.readLinkTargetPage(path, { maxBytes: 2, offset });
    expect(page.snapshot).toStrictEqual(resolver.snapshot);
    chunks.push(page.bytes);
    totalBytes += page.bytes.byteLength;

    if (page.isComplete) {
      const result = new Uint8Array(totalBytes);
      let writeOffset = 0;

      for (const chunk of chunks) {
        result.set(chunk, writeOffset);
        writeOffset += chunk.byteLength;
      }

      return result;
    }

    if (page.nextOffset === null) {
      throw new Error('An incomplete link target page omitted its continuation offset.');
    }

    offset = page.nextOffset;
  }

  throw new Error('Link target traversal ended without a complete page.');
};

const getTargetIdentity = <TPath extends string>(
  resolution: IRepositoryLinkResolverConformanceResolution<TPath>,
): string => {
  if (resolution.state !== 'inside' && resolution.state !== 'outside') {
    throw new Error(`Expected a resolved link target, received ${resolution.state}.`);
  }

  return resolution.targetIdentity;
};

/** Defines the contract checks shared by every official repository link resolver. */
export const describeRepositoryLinkResolverConformance = <TPath extends string>(
  implementationName: string,
  fixture: IRepositoryLinkResolverConformanceFixture<TPath>,
): void => {
  describe(`${implementationName} repository link resolver conformance`, () => {
    test('classifies non-link entries and rejects missing ones', async () => {
      const resolver = await fixture.createResolver();

      expect(resolver.snapshot.id.length).toBeGreaterThan(0);

      for (const path of fixture.notLinkPaths) {
        await expect(resolver.resolveLink(fixture.parsePath(path))).resolves.toStrictEqual({
          state: 'not-link',
        });
        await expectToRejectCode(
          resolver.readLinkTargetPage(fixture.parsePath(path), { maxBytes: 1, offset: 0 }),
          'ENTRY_NOT_FILE',
        );
      }

      await expectToRejectCode(
        resolver.resolveLink(fixture.parsePath(fixture.missingPath)),
        'ENTRY_NOT_FOUND',
      );
      await expectToRejectCode(
        resolver.readLinkTargetPage(fixture.parsePath(fixture.missingPath), {
          maxBytes: 1,
          offset: 0,
        }),
        'ENTRY_NOT_FOUND',
      );
    });

    test('resolves inside file links, including multi-hop chains, and reads their bytes', async () => {
      const resolver = await fixture.createResolver();

      for (const link of [fixture.insideFileLink, fixture.multiHopLink]) {
        const path = fixture.parsePath(link.path);
        const resolution = await resolver.resolveLink(path);

        expect(resolution).toStrictEqual({
          state: 'inside',
          targetIdentity: getTargetIdentity(resolution),
          targetPath: fixture.parsePath(link.targetPath),
          targetType: 'file',
        });
        expect(getTargetIdentity(resolution).length).toBeGreaterThan(0);
        await expect(readAllTargetBytes(resolver, path)).resolves.toStrictEqual(link.bytes);
      }

      const first = await resolver.resolveLink(fixture.parsePath(fixture.insideFileLink.path));
      const repeated = await resolver.resolveLink(fixture.parsePath(fixture.insideFileLink.path));
      expect(repeated).toStrictEqual(first);
    });

    test('resolves outside file links with comparable opaque identities', async () => {
      const resolver = await fixture.createResolver();
      const outsidePath = fixture.parsePath(fixture.outsideFileLink.path);
      const outside = await resolver.resolveLink(outsidePath);
      const alias = await resolver.resolveLink(fixture.parsePath(fixture.outsideFileAliasLinkPath));
      const other = await resolver.resolveLink(
        fixture.parsePath(fixture.outsideOtherFileLink.path),
      );

      expect(outside).toStrictEqual({
        state: 'outside',
        targetIdentity: getTargetIdentity(outside),
        targetType: 'file',
      });
      expect(other).toMatchObject({ state: 'outside', targetType: 'file' });
      expect(getTargetIdentity(alias)).toBe(getTargetIdentity(outside));
      expect(getTargetIdentity(other)).not.toBe(getTargetIdentity(outside));
      await expect(readAllTargetBytes(resolver, outsidePath)).resolves.toStrictEqual(
        fixture.outsideFileLink.bytes,
      );
      await expect(
        readAllTargetBytes(resolver, fixture.parsePath(fixture.outsideOtherFileLink.path)),
      ).resolves.toStrictEqual(fixture.outsideOtherFileLink.bytes);
    });

    test('resolves parent segments after a directory link to the source target', async () => {
      const resolver = await fixture.createResolver();
      const inside = fixture.parentAfterDirectoryLinks.inside;
      const insidePath = fixture.parsePath(inside.path);
      const outsidePath = fixture.parsePath(fixture.parentAfterDirectoryLinks.outside.path);
      const insideResolution = await resolver.resolveLink(insidePath);

      expect(insideResolution).toStrictEqual({
        state: 'inside',
        targetIdentity: getTargetIdentity(insideResolution),
        targetPath: fixture.parsePath(inside.targetPath),
        targetType: 'file',
      });
      await expect(readAllTargetBytes(resolver, insidePath)).resolves.toStrictEqual(inside.bytes);
      await expect(resolver.resolveLink(outsidePath)).resolves.toMatchObject({
        state: 'outside',
        targetType: 'file',
      });
      await expect(readAllTargetBytes(resolver, outsidePath)).resolves.toStrictEqual(
        fixture.parentAfterDirectoryLinks.outside.bytes,
      );
    });

    test('classifies directory and other targets without reading them', async () => {
      const resolver = await fixture.createResolver();
      const insideDirectory = await resolver.resolveLink(
        fixture.parsePath(fixture.insideDirectoryLink.path),
      );

      expect(insideDirectory).toStrictEqual({
        state: 'inside',
        targetIdentity: getTargetIdentity(insideDirectory),
        targetPath: fixture.parsePath(fixture.insideDirectoryLink.targetPath),
        targetType: 'directory',
      });
      await expect(
        resolver.resolveLink(fixture.parsePath(fixture.outsideDirectoryLinkPath)),
      ).resolves.toMatchObject({ state: 'outside', targetType: 'directory' });

      for (const path of fixture.otherTargetLinkPaths) {
        await expect(resolver.resolveLink(fixture.parsePath(path))).resolves.toMatchObject({
          targetType: 'other',
        });
      }

      for (const path of [
        fixture.insideDirectoryLink.path,
        fixture.outsideDirectoryLinkPath,
        ...fixture.otherTargetLinkPaths,
      ]) {
        await expectToRejectCode(
          resolver.readLinkTargetPage(fixture.parsePath(path), { maxBytes: 1, offset: 0 }),
          'ENTRY_NOT_FILE',
        );
      }
    });

    test.each([
      ['broken', 'brokenLinkPaths'],
      ['loop', 'loopLinkPaths'],
      ['denied', 'deniedLinkPaths'],
      ['unsafe', 'unsafeLinkPaths'],
    ] as const)('resolveLink(%s) -> %s without a readable target', async (state, key) => {
      const resolver = await fixture.createResolver();

      for (const path of fixture[key]) {
        await expect(resolver.resolveLink(fixture.parsePath(path)), path).resolves.toStrictEqual({
          state,
        });
        await expectToRejectCode(
          resolver.readLinkTargetPage(fixture.parsePath(path), { maxBytes: 1, offset: 0 }),
          'ENTRY_NOT_FILE',
        );
      }
    });

    test('bounds target reads and honors cancellation', async () => {
      const resolver = await fixture.createResolver();
      const path = fixture.parsePath(fixture.insideFileLink.path);
      const aborted = new AbortController();
      aborted.abort(new Error('cancelled by test'));

      await expectToRejectCode(
        resolver.readLinkTargetPage(path, { maxBytes: fixture.maxReadBytes + 1, offset: 0 }),
        'RESOURCE_LIMIT_EXCEEDED',
      );
      await expectToRejectCode(
        resolver.readLinkTargetPage(path, { maxBytes: 0, offset: 0 }),
        'INVALID_PAGE_REQUEST',
      );
      await expectToRejectCode(
        resolver.readLinkTargetPage(path, {
          maxBytes: 1,
          offset: fixture.insideFileLink.bytes.byteLength + 1,
        }),
        'INVALID_PAGE_REQUEST',
      );
      const cancelled = resolver.resolveLink(path, { signal: aborted.signal });
      await expectToRejectCode(cancelled, 'ABORTED');
      expect(
        fixture.isRepositorySourceException(await cancelled.catch((cause: unknown) => cause)),
      ).toBe(true);
      await expectToRejectCode(
        resolver.readLinkTargetPage(path, { maxBytes: 1, offset: 0, signal: aborted.signal }),
        'ABORTED',
      );
    });

    test('rejects a target replaced between resolution and read', async () => {
      const scenario = await fixture.createTargetReplacementFixture();
      const path = fixture.parsePath(scenario.linkPath);

      await scenario.resolver.resolveLink(path);
      await scenario.mutateSource();
      await expectToRejectCode(
        scenario.resolver.readLinkTargetPage(path, { maxBytes: 1, offset: 0 }),
        'SNAPSHOT_CHANGED',
      );
    });

    test('rejects resolution after the repository root is replaced', async () => {
      const scenario = await fixture.createRootReplacementFixture();
      const path = fixture.parsePath(scenario.linkPath);

      await scenario.resolver.resolveLink(path);
      await scenario.mutateSource();
      await expectToRejectCode(scenario.resolver.resolveLink(path), 'SNAPSHOT_CHANGED');
    });

    test('never exposes host paths in results or exceptions', async () => {
      const resolver = await fixture.createResolver();
      const observed: string[] = [];
      const paths = [
        fixture.insideFileLink.path,
        fixture.multiHopLink.path,
        fixture.insideDirectoryLink.path,
        fixture.outsideDirectoryLinkPath,
        fixture.outsideFileLink.path,
        fixture.outsideFileAliasLinkPath,
        fixture.outsideOtherFileLink.path,
        fixture.parentAfterDirectoryLinks.inside.path,
        fixture.parentAfterDirectoryLinks.outside.path,
        fixture.missingPath,
        ...fixture.notLinkPaths,
        ...fixture.otherTargetLinkPaths,
        ...fixture.brokenLinkPaths,
        ...fixture.loopLinkPaths,
        ...fixture.deniedLinkPaths,
        ...fixture.unsafeLinkPaths,
      ];

      for (const path of paths) {
        const logicalPath = fixture.parsePath(path);

        for (const operation of [
          () => resolver.resolveLink(logicalPath),
          () =>
            resolver.readLinkTargetPage(logicalPath, {
              maxBytes: fixture.maxReadBytes + 1,
              offset: 0,
            }),
        ]) {
          try {
            observed.push(JSON.stringify(await operation()));
          } catch (cause) {
            observed.push(
              cause instanceof Error ? `${cause.message} ${JSON.stringify(cause)}` : '',
            );
          }
        }
      }

      for (const fragment of fixture.hostPathFragments) {
        expect(observed.filter((text) => text.includes(fragment))).toStrictEqual([]);
      }
    });
  });
};
