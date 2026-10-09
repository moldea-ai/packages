// @vitest-environment node
import { expect, test, vi } from 'vitest';

import { analyzeTypeScriptModule } from '../typescript-analysis/index.js';

import { getSourceRetainedBytes } from './retention.js';
import { createInspectionSessionFactory } from './session.js';

test('uses syntax cost to retain a comment source and discard an equally sized dense graph', async () => {
  const encoder = new TextEncoder();
  const dense = `export const agent = [${'0,'.repeat(131072)}];`;
  const comment = `export const agent = 0; /*${'x'.repeat(dense.length - 28)}*/`;
  const analyzeSource = vi.fn((path: string, bytes: Uint8Array) =>
    analyzeTypeScriptModule(path, bytes, {
      namedConstructorImports: [],
      packageName: 'provider',
      supportsDefaultConstructorImport: false,
    }),
  );
  const createSession = createInspectionSessionFactory((owner: object) => ({
    owner,
    activeSourcePath: '/dense.ts',
    analyzeSource,
    getSourceRetainedBytes,
    readFile: (path: string) =>
      Promise.resolve(encoder.encode(path === '/dense.ts' ? dense : comment)),
    discoverPackage: () => Promise.resolve(null),
    getEntry: () => Promise.resolve(null),
  }));
  const owner = {};
  const first = createSession(owner);
  const denseResult = await first.analyzeSource('/dense.ts');
  const commentResult = await first.analyzeSource('/comment.ts');
  expect(denseResult.kind).toBe('valid');
  expect(commentResult.kind).toBe('valid');
  expect(Math.abs(dense.length - comment.length)).toBeLessThan(4);
  expect(getSourceRetainedBytes(denseResult)).toBeGreaterThan(16 * 1024 * 1024);
  expect(getSourceRetainedBytes(commentResult)).toBeLessThan(16 * 1024 * 1024);
  expect(await first.analyzeSource('/dense.ts')).toBe(denseResult);
  expect(analyzeSource).toHaveBeenCalledTimes(2);

  const second = createSession(owner);
  expect(await second.analyzeSource('/comment.ts')).toBe(commentResult);
  expect(await second.analyzeSource('/dense.ts')).not.toBe(denseResult);
  expect(analyzeSource).toHaveBeenCalledTimes(3);
});
