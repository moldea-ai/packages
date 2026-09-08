// @vitest-environment node
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';

import { verifyProductionBuild } from './verify-build.ts';

describe('verifyProductionBuild', () => {
  test('accepts the complete base-aware Astro production artifact', () => {
    expect(() => verifyProductionBuild()).not.toThrow();
  });
});

describe('production discovery guards', () => {
  let directory: string;
  const originals = new Map<string, string>();
  const sourceDirectory = fileURLToPath(new URL('../dist/', import.meta.url));

  beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), 'moldea-artifact-check-'));
    cpSync(sourceDirectory, directory, {
      recursive: true,
      filter: (path) =>
        !path
          .split(sep)
          .some((part) => ['_archive', '_archives', '_backup', '_backups'].includes(part)),
    });
  });
  afterEach(() => {
    for (const [path, original] of originals) writeFileSync(path, original);
    originals.clear();
  });
  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  const replaceArtifactText = (
    relativePath: string,
    originalText: string,
    replacement: string,
  ): void => {
    const path = join(directory, relativePath);
    const original = readFileSync(path, 'utf8');
    expect(original).toContain(originalText);
    originals.set(path, original);
    writeFileSync(path, original.replaceAll(originalText, replacement));
  };

  test('rejects a guide that loses the adoption handoff', () => {
    replaceArtifactText(
      'getting-started/index.html',
      'https://skill.moldea.ai/',
      'https://example.com/',
    );
    expect(() => verifyProductionBuild(directory)).toThrow('getting-started artifact omits');
  });
  test('rejects a machine map that loses the external Skill handoff', () => {
    replaceArtifactText('llms.txt', 'https://skill.moldea.ai/', 'https://example.com/');
    expect(() => verifyProductionBuild(directory)).toThrow('llms.txt omits');
  });
  test('rejects a homepage that loses the diagnostic', () => {
    replaceArtifactText('index.html', 'MOLDEA_REFERENCE_MISSING', 'REMOVED_DIAGNOSTIC');
    expect(() => verifyProductionBuild(directory)).toThrow(
      'homepage omits the real Core diagnostic',
    );
  });
  test('rejects test-file leakage in the static artifact', () => {
    const path = join(directory, '_index.test-e2e.js');
    writeFileSync(path, 'export {};');
    try {
      expect(() => verifyProductionBuild(directory)).toThrow(
        'static artifact contains test output',
      );
    } finally {
      rmSync(path);
    }
  });

  test('rejects leftover Website UI documentation after a cached build', () => {
    const retiredDirectory = join(directory, 'packages', 'website-ui');
    mkdirSync(retiredDirectory, { recursive: true });
    writeFileSync(join(retiredDirectory, 'index.html'), '<h1>Retired documentation</h1>');
    try {
      expect(() => verifyProductionBuild(directory)).toThrow(
        'The static artifact contains retired Website UI documentation.',
      );
    } finally {
      rmSync(retiredDirectory, { recursive: true });
    }
  });
});
