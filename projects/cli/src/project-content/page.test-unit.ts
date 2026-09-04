// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';

import { serializeJsonDeterministically } from '../json-serialization/index.js';
import { encodeMoldeaCliCursor, MoldeaCliOutputPageException } from '../output-page/index.js';

import { createMoldeaCliContentPage } from './page.js';

const CONTENT_DIGEST = `sha256:${'3'.repeat(64)}`;

const createAsset = (content: string) => ({
  content,
  digest: CONTENT_DIGEST,
  path: parseRepositoryPath('/moldea/project.md'),
  scalarLength: Array.from(content).length,
  utf8ByteLength: Buffer.byteLength(content, 'utf8'),
});

const measureContentResult = (result: unknown): number =>
  Buffer.byteLength(serializeJsonDeterministically(result), 'utf8');

describe('content pages', () => {
  test('splits content on Unicode scalar boundaries and continues exactly', () => {
    const asset = createAsset('A😀éZ');
    const firstCursor = encodeMoldeaCliCursor(
      'content',
      { path: asset.path },
      asset.digest,
      'scalar:2',
    );
    const exactFirstResult = {
      asset: {
        digest: asset.digest,
        path: asset.path,
        scalarLength: asset.scalarLength,
        utf8ByteLength: asset.utf8ByteLength,
      },
      chunk: { content: 'A😀', scalarEnd: 2, scalarStart: 0 },
      cursor: firstCursor,
      snapshotDigest: asset.digest,
    };
    const firstPage = createMoldeaCliContentPage({
      asset,
      cursor: null,
      maxOutputBytes: measureContentResult(exactFirstResult),
      measure: measureContentResult,
    });
    const secondPage = createMoldeaCliContentPage({
      asset,
      cursor: firstPage.cursor,
      maxOutputBytes: 4096,
      measure: measureContentResult,
    });

    expect(firstPage).toStrictEqual(exactFirstResult);
    expect(secondPage.chunk).toStrictEqual({ content: 'éZ', scalarEnd: 4, scalarStart: 2 });
    expect(secondPage.cursor).toBeNull();
    expect(`${firstPage.chunk.content}${secondPage.chunk.content}`).toBe(asset.content);
  });

  test('returns one complete empty-content result', () => {
    const result = createMoldeaCliContentPage({
      asset: createAsset(''),
      cursor: null,
      maxOutputBytes: 4096,
      measure: measureContentResult,
    });

    expect(result.chunk).toStrictEqual({ content: '', scalarEnd: 0, scalarStart: 0 });
    expect(result.cursor).toBeNull();
  });

  test('rejects a cursor at the final scalar and a budget below one scalar', () => {
    const asset = createAsset('A');
    const finalCursor = encodeMoldeaCliCursor(
      'content',
      { path: asset.path },
      asset.digest,
      'scalar:1',
    );

    expect(() =>
      createMoldeaCliContentPage({
        asset,
        cursor: finalCursor,
        maxOutputBytes: 4096,
        measure: measureContentResult,
      }),
    ).toThrow(MoldeaCliOutputPageException);
    expect(() =>
      createMoldeaCliContentPage({
        asset,
        cursor: null,
        maxOutputBytes: 1,
        measure: measureContentResult,
      }),
    ).toThrow(MoldeaCliOutputPageException);
  });
});
