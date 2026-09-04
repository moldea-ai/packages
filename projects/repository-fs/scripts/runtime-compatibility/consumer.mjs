import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  REPOSITORY_ROOT,
  RepositorySourceException,
  parseRepositoryPath,
} from '@moldea.ai/repository';
import * as repositoryFilesystem from '@moldea.ai/repository-fs';

/** Collects one public reader listing through its bounded continuation contract. */
const collectEntries = async (reader) => {
  const collectedEntries = [];
  let cursor;

  while (cursor !== null) {
    const page = await reader.listEntriesPage({
      ...(cursor === undefined ? {} : { cursor }),
      maxEntries: 2,
    });
    collectedEntries.push(...page.entries);

    if (page.isComplete) {
      return collectedEntries;
    }

    assert.notEqual(page.nextCursor, null);
    cursor = page.nextCursor;
  }

  return collectedEntries;
};

assert.deepStrictEqual(Object.keys(repositoryFilesystem).sort(), [
  'DEFAULT_FILESYSTEM_REPOSITORY_RESOURCE_LIMITS',
  'createFilesystemRepositoryReader',
]);
assert.deepStrictEqual(repositoryFilesystem.DEFAULT_FILESYSTEM_REPOSITORY_RESOURCE_LIMITS, {
  maxCachedBytes: 67_108_864,
  maxConcurrentOperations: 16,
  maxDirectoryEntries: 131_072,
  maxEntries: 131_072,
  maxPageEntries: 4_096,
  maxQueuedOperations: 256,
  maxReadBytes: 1_048_576,
});
assert.equal(
  Object.isFrozen(repositoryFilesystem.DEFAULT_FILESYSTEM_REPOSITORY_RESOURCE_LIMITS),
  true,
);

const temporaryDirectory = await mkdtemp(
  path.join(tmpdir(), 'moldea-repository-fs-runtime-fixture-'),
);
const rootDirectory = path.join(temporaryDirectory, 'repository');
const nestedDirectory = path.join(rootDirectory, 'nested');
const filePath = parseRepositoryPath('/nested/fixture.bin');
const fileBytes = Uint8Array.from([0x00, 0x7f, 0x80, 0xff]);

try {
  await mkdir(nestedDirectory, { recursive: true });
  await writeFile(path.join(nestedDirectory, 'fixture.bin'), fileBytes);

  const reader = await repositoryFilesystem.createFilesystemRepositoryReader({
    rootDirectory,
    selection: { kind: 'paths', paths: [filePath] },
  });

  assert.equal(Object.isFrozen(reader), true);
  assert.equal(typeof reader.getEntry, 'function');
  assert.equal(typeof reader.listEntriesPage, 'function');
  assert.equal(typeof reader.readFilePage, 'function');
  assert.equal(typeof reader.compare, 'function');
  assert.deepStrictEqual(await reader.getEntry(REPOSITORY_ROOT), {
    byteLength: null,
    contentIdentity: null,
    path: REPOSITORY_ROOT,
    type: 'directory',
  });
  assert.deepStrictEqual(
    { ...(await reader.getEntry(filePath)), contentIdentity: 'present' },
    { byteLength: 4, contentIdentity: 'present', path: filePath, type: 'file' },
  );
  assert.deepStrictEqual(await collectEntries(reader), [
    {
      byteLength: null,
      contentIdentity: null,
      path: parseRepositoryPath('/nested'),
      type: 'directory',
    },
    {
      byteLength: 4,
      contentIdentity: (await reader.getEntry(filePath)).contentIdentity,
      path: filePath,
      type: 'file',
    },
  ]);
  assert.deepStrictEqual(
    await reader.readFilePage(filePath, { maxBytes: fileBytes.byteLength, offset: 0 }),
    {
      bytes: fileBytes,
      isComplete: true,
      nextOffset: null,
      offset: 0,
      snapshot: reader.snapshot,
      totalBytes: fileBytes.byteLength,
    },
  );

  const missingRoot = path.join(temporaryDirectory, 'private-missing-root');
  let rejection;

  try {
    await repositoryFilesystem.createFilesystemRepositoryReader({
      rootDirectory: missingRoot,
      selection: { kind: 'directory' },
    });
  } catch (cause) {
    rejection = cause;
  }

  assert.equal(rejection instanceof RepositorySourceException, true);
  assert.equal(rejection.code, 'ENTRY_NOT_FOUND');
  assert.equal(rejection.message, 'The requested repository entry was not found.');
  assert.equal(rejection.operation, 'create-reader');
  assert.equal(rejection.path, null);
  assert.equal(rejection.retryable, true);
  assert.equal(Object.keys(rejection).includes('cause'), false);
  assert.equal(JSON.stringify(rejection).includes(JSON.stringify(missingRoot).slice(1, -1)), false);
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
