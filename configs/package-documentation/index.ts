import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Verifies local adapter documentation against the package manager's packed file inventory.
 * Only the package-owned flat Markdown documentation directory is inspected.
 * @param projectDirectory The adapter package directory.
 * @param packedPaths The logical paths returned by the existing package packing check.
 * @throws
 * - If a required document or a local Markdown link target is not packed
 */
export const verifyPackedDocumentation = (
  projectDirectory: string,
  packedPaths: readonly string[],
): void => {
  const packedFiles = new Set(packedPaths);
  const documentPaths = [
    'README.md',
    ...readdirSync(path.join(projectDirectory, 'docs'), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => `docs/${entry.name}`),
  ];

  if (!documentPaths.includes('docs/index.md')) {
    throw new Error('The package documentation index is missing.');
  }

  for (const documentPath of documentPaths) {
    if (!packedFiles.has(documentPath)) {
      throw new Error(`The package documentation is not packed: ${documentPath}.`);
    }

    const source = readFileSync(path.join(projectDirectory, documentPath), 'utf8');

    // package docs use literal inline links/images and optional reference definitions
    const links = [
      ...source.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/gu),
      ...source.matchAll(/^\s*\[[^\]]+\]:\s*(\S+)/gmu),
    ];

    for (const match of links) {
      const target = match[1]?.replace(/^<|>$/gu, '');

      if (target === undefined || target.startsWith('#') || /^(?:https?:|mailto:)/iu.test(target)) {
        continue;
      }

      const targetPath = decodeURIComponent(target.split(/[?#]/u)[0] ?? '');
      const resolvedPath = path.posix.normalize(
        path.posix.join(path.posix.dirname(documentPath), targetPath),
      );

      if (
        targetPath.startsWith('/') ||
        targetPath.includes('\\') ||
        /^[a-z][a-z\d+.-]*:/iu.test(targetPath) ||
        resolvedPath === '..' ||
        resolvedPath.startsWith('../') ||
        !packedFiles.has(resolvedPath)
      ) {
        throw new Error(
          `The package documentation link is not packed: ${documentPath} -> ${target}.`,
        );
      }
    }
  }
};
