// @vitest-environment node
import { expect, test } from 'vitest';

import { analyzeTypeScriptModule } from '../typescript-analysis/index.js';
import { inspectDeclaredExports } from './exports.js';

test.each([
  ["export type { Handler } from './outside.js';", 'Handler'],
  ["export type * as Handler from './outside.js';", 'Handler'],
  ['export interface Handler {}', 'Handler'],
  ['export default interface Handler {}', 'default'],
  ['export declare const Handler: unknown;', 'Handler'],
  ['export declare function Handler(): void;', 'Handler'],
  ['export declare class Handler {}', 'Handler'],
  ['export declare enum Handler { First }', 'Handler'],
  ['export declare namespace Handler { const member: unknown; }', 'Handler'],
])('inspectDeclaredExports(%s, %s) -> missing runtime value', async (content, symbol) => {
  const failures = [];
  for await (const failure of inspectDeclaredExports(
    { bindings: { runtimeAgent: { path: '/src/handler.ts', symbol } } },
    (path) =>
      Promise.resolve(
        analyzeTypeScriptModule(path, new TextEncoder().encode(content), {
          namedConstructorImports: [],
          packageName: 'provider',
          supportsDefaultConstructorImport: false,
        }),
      ),
  )) {
    failures.push(failure);
  }
  expect(failures).toStrictEqual([
    {
      subject: { reference: { path: '/src/handler.ts', symbol }, relationship: 'runtime-agent' },
      kind: 'missing',
      range: null,
    },
  ]);
});

test('checks independent exports without mistaking wildcard or unsupported sources for absence', async () => {
  const sources: Record<string, string> = {
    '/missing.ts': 'export const present = () => 1;',
    '/wildcard.ts': "export * from './outside.js';",
    '/known.ts': "export { handler } from './outside.js';",
    '/namespace.ts': "export * as handlers from './outside.js';",
    '/syntax.ts': 'export const = ;',
  };
  const failures = [];
  for await (const failure of inspectDeclaredExports(
    {
      bindings: { runtimeAgent: { path: '/wildcard.ts', symbol: 'runtime' } },
      tools: {
        absent: { implementation: { path: '/missing.ts', symbol: 'handler' } },
        known: { implementation: { path: '/known.ts', symbol: 'handler' } },
        namespace: { implementation: { path: '/namespace.ts', symbol: 'handlers' } },
        unsupported: { implementation: { path: '/handler.py', symbol: 'handler' } },
        syntax: { implementation: { path: '/syntax.ts', symbol: 'handler' } },
      },
    },
    (path) =>
      Promise.resolve(
        analyzeTypeScriptModule(path, new TextEncoder().encode(sources[path] ?? ''), {
          namedConstructorImports: [],
          packageName: 'provider',
          supportsDefaultConstructorImport: false,
        }),
      ),
  )) {
    failures.push({ kind: failure.kind, capabilityId: failure.subject.capabilityId });
  }
  expect(failures).toStrictEqual([
    { kind: 'missing', capabilityId: 'absent' },
    { kind: 'invalid-syntax', capabilityId: 'syntax' },
  ]);
});
