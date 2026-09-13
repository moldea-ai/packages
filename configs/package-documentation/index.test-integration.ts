// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { verifyPackedDocumentation } from './index.js';

let projectDirectory: string;
const packedPaths = ['README.md', 'docs/index.md', 'docs/target.md', 'cover.png'];

beforeEach(() => {
  projectDirectory = mkdtempSync(path.join(tmpdir(), 'moldea-package-docs-'));
  mkdirSync(path.join(projectDirectory, 'docs'));
  writeFileSync(
    path.join(projectDirectory, 'README.md'),
    '[Docs](./docs/index.md)\n![Cover](cover.png)',
  );
  writeFileSync(path.join(projectDirectory, 'docs/index.md'), '[Target](target.md#pattern)');
  writeFileSync(path.join(projectDirectory, 'docs/target.md'), '# Target\n[README](../README.md)');
});

afterEach(() => {
  rmSync(projectDirectory, { recursive: true, force: true });
});

describe('verifyPackedDocumentation', () => {
  test('accepts package-local links, images, anchors and explicit website links', () => {
    writeFileSync(
      path.join(projectDirectory, 'docs/target.md'),
      '[Home](../README.md) [Anchor](#pattern) [API](https://packages.moldea.ai/adapters/eve/api/)',
    );
    expect(() => verifyPackedDocumentation(projectDirectory, packedPaths)).not.toThrow();
  });

  test.each(['README.md', 'docs/index.md', 'docs/target.md'])(
    'rejects an omitted %s even when it exists in the source tree',
    (missingPath) => {
      expect(() =>
        verifyPackedDocumentation(
          projectDirectory,
          packedPaths.filter((filePath) => filePath !== missingPath),
        ),
      ).toThrow('not packed');
    },
  );

  test.each([
    './api/',
    '/compatibility/',
    '../../outside.md',
    '%2e%2e/%2e%2e/outside.md',
    'C:\\outside.md',
    'file:///outside.md',
    'missing.md',
  ])('rejects an unavailable or non-local link %s', (target) => {
    writeFileSync(path.join(projectDirectory, 'docs/index.md'), `[Reference](${target})`);
    expect(() => verifyPackedDocumentation(projectDirectory, packedPaths)).toThrow(
      'link is not packed',
    );
  });

  test('checks reference-style targets and image assets', () => {
    writeFileSync(
      path.join(projectDirectory, 'docs/index.md'),
      '[Guide][target]\n\n[target]: missing.md',
    );
    expect(() => verifyPackedDocumentation(projectDirectory, packedPaths)).toThrow(
      'link is not packed',
    );
    writeFileSync(path.join(projectDirectory, 'docs/index.md'), '![Diagram](missing.png)');
    expect(() => verifyPackedDocumentation(projectDirectory, packedPaths)).toThrow(
      'link is not packed',
    );
  });
});
