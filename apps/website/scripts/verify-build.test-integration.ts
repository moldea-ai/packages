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
  test.each([
    'MOLDEA_REFERENCE_MISSING',
    'MOLDEA_TOOL_IMPLEMENTATION_MISSING',
    'id="hero-check-result"',
  ])('rejects a homepage that loses %s', (marker) => {
    replaceArtifactText('index.html', marker, 'REMOVED_EXAMPLE');
    expect(() => verifyProductionBuild(directory)).toThrow(
      'homepage omits the real Core diagnostic',
    );
  });

  test.each([
    ['http-equiv="refresh"', 'http-equiv="invalid"'],
    ['content="0;url=', 'content="2;url='],
    ['adapters/', 'packages/'],
    ['content="noindex"', 'content="index"'],
    ['rel="canonical"', 'rel="alternate"'],
    ['<a href=', '<a data-href='],
  ])('rejects a compatibility redirect with altered %s', (original, replacement) => {
    replaceArtifactText('compatibility/index.html', original, replacement);
    expect(() => verifyProductionBuild(directory)).toThrow(
      'compatibility redirect must immediately hand off',
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

  test.each([
    ['id="structure"', 'data-removed="structure"', 'missing local anchor'],
    [
      'data-capability-outcome="variable-undeclared"',
      'data-removed="variable-undeclared"',
      'omits visible result variable-undeclared',
    ],
    [
      'data-capability-outcome="mirror-stale"',
      'data-removed="mirror-stale"',
      'omits visible result mirror-stale',
    ],
    [
      'id="result-mirror-stale"',
      'data-removed="result-mirror-stale"',
      'omits result dialog mirror-stale',
    ],
    [
      'data-capability-outcome="openai-responses"',
      'data-removed="openai-responses"',
      'omits visible result openai-responses',
    ],
  ])('rejects missing capability marker %s', (marker, replacement, error) => {
    replaceArtifactText('capabilities/index.html', marker, replacement);
    expect(() => verifyProductionBuild(directory)).toThrow(error);
  });
  test('rejects an unselected example leaking into the curated page', () => {
    replaceArtifactText(
      'capabilities/index.html',
      '</main>',
      '<div data-capability-outcome="extra-example"></div></main>',
    );
    expect(() => verifyProductionBuild(directory)).toThrow('contains an unselected example');
  });
  test('rejects a capability machine-navigation omission', () => {
    replaceArtifactText('llms.txt', '[Capabilities]', '[Removed]');
    expect(() => verifyProductionBuild(directory)).toThrow(
      'Capabilities machine discovery is missing',
    );
  });
  test('rejects capability search fragments that no longer identify the rendered case', () => {
    replaceArtifactText('search-index.json', '#mirror-stale', '#unknown-capability');
    expect(() => verifyProductionBuild(directory)).toThrow('Capabilities search discovery');
  });
  test('rejects private capability-generation artifacts', () => {
    const privateDirectory = join(directory, '.generated');
    mkdirSync(privateDirectory);
    try {
      writeFileSync(join(privateDirectory, 'model.json'), '{}');
      expect(() => verifyProductionBuild(directory)).toThrow('private generation output');
    } finally {
      rmSync(privateDirectory, { recursive: true });
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
