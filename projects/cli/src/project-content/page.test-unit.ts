// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';

import { serializeJsonDeterministically } from '../json-serialization/index.js';
import { MoldeaCliOutputPageException } from '../output-page/index.js';

import { createMoldeaCliContentPage } from './page.js';

const SOURCE = Object.freeze({ id: 'memory:content', sourceKind: 'memory' });
const PATH = parseRepositoryPath('/moldea/project.md');

const createPage = (content: string, isComplete = true) => ({
  byteEnd: Buffer.byteLength(content, 'utf8'),
  byteStart: 0,
  content,
  contentIdentity: `sha256:${'3'.repeat(64)}`,
  isComplete,
  nextOffset: isComplete ? null : Buffer.byteLength(content, 'utf8'),
  path: PATH,
  source: SOURCE,
  totalBytes: isComplete ? Buffer.byteLength(content, 'utf8') : 100,
});

const measureContentResult = (result: unknown): number =>
  Buffer.byteLength(serializeJsonDeterministically(result), 'utf8');

describe('content pages', () => {
  test('splits a bounded source range on Unicode scalar boundaries', () => {
    const page = createPage('A😀éZ', false);
    const full = createMoldeaCliContentPage({
      cursor: null,
      maxOutputBytes: 4096,
      measure: measureContentResult,
      page,
    });
    const prefix = createMoldeaCliContentPage({
      cursor: null,
      maxOutputBytes: measureContentResult(full) - 1,
      measure: measureContentResult,
      page,
    });

    expect(prefix.chunk.byteEnd).toBeLessThan(page.byteEnd);
    expect(Buffer.from(prefix.chunk.content, 'utf8').toString('utf8')).toBe(prefix.chunk.content);
    expect(prefix.cursor).not.toBeNull();
  });

  test('returns one complete empty-content result', () => {
    const result = createMoldeaCliContentPage({
      cursor: null,
      maxOutputBytes: 4096,
      measure: measureContentResult,
      page: createPage(''),
    });

    expect(result.chunk).toStrictEqual({ byteEnd: 0, byteStart: 0, content: '' });
    expect(result.cursor).toBeNull();
  });

  test('rejects a budget below one complete scalar', () => {
    expect(() =>
      createMoldeaCliContentPage({
        cursor: null,
        maxOutputBytes: 1,
        measure: measureContentResult,
        page: createPage('A'),
      }),
    ).toThrow(MoldeaCliOutputPageException);
  });
});
