// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { buildEvaluationReplayPathTree } from './index.js';

describe('buildEvaluationReplayPathTree', () => {
  test('builds sorted structural folders with child-only path labels', () => {
    expect(
      buildEvaluationReplayPathTree([
        { path: 'src/triage-agent.mjs', type: 'file' },
        { path: 'README.md', type: 'file' },
        { path: 'src/contracts/input.ts', type: 'file' },
        { path: 'src/current-agent', type: 'symlink' },
      ]),
    ).toStrictEqual([
      {
        changeCount: 1,
        children: [],
        kind: 'file',
        name: 'README.md',
        path: 'README.md',
      },
      {
        changeCount: 3,
        children: [
          {
            changeCount: 1,
            children: [
              {
                changeCount: 1,
                children: [],
                kind: 'file',
                name: 'input.ts',
                path: 'src/contracts/input.ts',
              },
            ],
            kind: 'folder',
            name: 'contracts',
            path: 'src/contracts',
          },
          {
            changeCount: 1,
            children: [],
            kind: 'symlink',
            name: 'current-agent',
            path: 'src/current-agent',
          },
          {
            changeCount: 1,
            children: [],
            kind: 'file',
            name: 'triage-agent.mjs',
            path: 'src/triage-agent.mjs',
          },
        ],
        kind: 'folder',
        name: 'src',
        path: 'src',
      },
    ]);
  });

  test.each(['', '/src/file.ts', 'src\\file.ts', 'src//file.ts', './file.ts', '../file.ts'])(
    'rejects unsafe path %s',
    (path) => {
      expect(() => buildEvaluationReplayPathTree([{ path, type: 'file' }])).toThrow(
        'is not repository-relative',
      );
    },
  );

  test('rejects duplicate paths', () => {
    expect(() =>
      buildEvaluationReplayPathTree([
        { path: 'src/file.ts', type: 'file' },
        { path: 'src/file.ts', type: 'file' },
      ]),
    ).toThrow('is duplicated');
  });

  test('rejects structural file and folder conflicts', () => {
    expect(() =>
      buildEvaluationReplayPathTree([
        { path: 'src', type: 'file' },
        { path: 'src/file.ts', type: 'file' },
      ]),
    ).toThrow('conflicts with');
  });
});
