import { lstat, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { IFixtureFile, IFixtureWorkspace } from './types.ts';

const reservedName = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
const excludedDirectories = new Set(['_archive', '_archives', '_backup', '_backups']);

/**
 * Resolves a portable fixture path without accepting traversal, device names, or host paths.
 * @returns The native path below the explicitly supplied workspace.
 * @throws
 * - A capability fixture path is unsafe.
 */
export const resolveFixturePath = (directory: string, logicalPath: string): string => {
  const components = logicalPath.slice(1).split('/');
  if (
    !logicalPath.startsWith('/') ||
    logicalPath.length > 160 ||
    components.some(
      (component) =>
        !/^[a-z0-9._-]+$/u.test(component) ||
        component.length > 64 ||
        component === '.' ||
        component === '..' ||
        component.endsWith('.') ||
        reservedName.test(component) ||
        excludedDirectories.has(component),
    )
  ) {
    throw new Error('A capability fixture path is unsafe.');
  }
  const destination = path.resolve(directory, ...components);
  const relative = path.relative(directory, destination);
  if (
    relative === '' ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error('A capability fixture path is unsafe.');
  }
  return destination;
};

/** Writes only through directories owned by the fixture, refusing intervening links. */
const writeFixtureFile = async (directory: string, file: IFixtureFile): Promise<void> => {
  const destination = resolveFixturePath(directory, file.path);
  const components = path
    .relative(directory, path.dirname(destination))
    .split(path.sep)
    .filter(Boolean);
  let parent = directory;
  for (const component of components) {
    parent = path.join(parent, component);
    await mkdir(parent, { recursive: true });
    if (!(await lstat(parent)).isDirectory())
      throw new Error('A capability fixture path is unsafe.');
  }
  const existing = await lstat(destination).catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  });
  if (existing !== null && !existing.isFile())
    throw new Error('A capability fixture path is unsafe.');
  await writeFile(destination, file.content);
};

/**
 * Owns a disposable workspace and removes only that workspace, on success or failure.
 * @returns The operation’s result after temporary files have been removed.
 * @throws
 * - A capability fixture path is unsafe.
 */
export const withFixtureWorkspace = async <T>(
  files: IFixtureFile[],
  operation: (workspace: IFixtureWorkspace) => Promise<T>,
): Promise<T> => {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'moldea-capabilities-')));
  try {
    const write = (file: IFixtureFile) => writeFixtureFile(directory, file);
    for (const file of files) await write(file);
    return await operation({ directory, write });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};
