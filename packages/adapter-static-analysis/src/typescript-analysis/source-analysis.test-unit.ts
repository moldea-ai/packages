// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { IStaticAnalysisSourceConfig } from '../types.js';
import {
  analyzeSource,
  analyzeTypeScriptModule,
  getCallableExportState,
  getConstExport,
  getRuntimeExport,
  isSupportedTypeScriptSourcePath,
} from './source-analysis.js';

const SOURCE_CONFIG: IStaticAnalysisSourceConfig = {
  importConfig: {
    namedConstructorImports: ['Client'],
    packageName: 'provider',
    supportsDefaultConstructorImport: true,
  },
  requestConfig: {
    acceptedArgumentCounts: [1],
    methodNames: ['create'],
    relationshipNames: ['tools'],
    resourceName: 'messages',
    toolRelationshipName: 'tools',
  },
};

describe('TypeScript source analysis', () => {
  test.each([
    ["export * from './external.js';", 'unresolved'],
    ["export type * from './external.js';", 'absent'],
    ["export { known } from './external.js';", 'absent'],
    ['export const { dynamic } = input;', 'unresolved'],
    ['module.exports = buildExports();', 'unresolved'],
    ['exports[name] = implementation;', 'unresolved'],
    ['export default buildExports();', 'absent'],
    ['const module = { exports: {} }; module.exports = {};', 'absent'],
  ])('classifies incomplete exports (%s) -> %s', (source, expected) => {
    const result = analyzeSource('/src/agent.ts', new TextEncoder().encode(source), SOURCE_CONFIG);
    if (result.kind !== 'valid') throw new TypeError('The source fixture must be valid.');
    expect(getRuntimeExport(result.analysis, 'missing').kind).toBe(expected);
    expect(getCallableExportState(result.analysis, 'missing').kind).toBe(expected);
    expect(getConstExport(result.analysis, 'missing').kind).toBe(expected);
  });

  test('preserves known exports beside an unresolved wildcard', () => {
    const result = analyzeSource(
      '/src/agent.ts',
      new TextEncoder().encode("export * from './external.js'; export const known = () => 1;"),
      SOURCE_CONFIG,
    );
    if (result.kind !== 'valid') throw new TypeError('The source fixture must be valid.');
    expect(getRuntimeExport(result.analysis, 'known').kind).toBe('present-supported');
  });
  test.each([
    ['export default () => 1;'],
    ['export default function agent() { return 1; }'],
    ['export default class Agent {}'],
  ])('retains known default export existence (%s)', (source) => {
    const result = analyzeSource('/src/agent.ts', new TextEncoder().encode(source), SOURCE_CONFIG);
    if (result.kind !== 'valid') throw new TypeError('The source fixture must be valid.');
    expect(result.analysis.exports.has('default')).toBe(true);
    expect(getConstExport(result.analysis, 'missing').kind).toBe('absent');
    expect(result.analysis.exports.has('agent')).toBe(false);
  });

  test('follows immutable callable aliases and rejects cycles or replaced bindings', () => {
    const result = analyzeSource(
      '/src/agent.ts',
      new TextEncoder().encode(
        'const implementation = () => 1; export const alias = implementation; const a = b; const b = a; export const cycle = a; export let replaced = () => 1; replaced = () => 2;',
      ),
      SOURCE_CONFIG,
    );
    if (result.kind !== 'valid') throw new TypeError('The source fixture must be valid.');
    expect(getRuntimeExport(result.analysis, 'alias').kind).toBe('present-supported');
    expect(getRuntimeExport(result.analysis, 'cycle').kind).toBe('present-unsupported');
    expect(getRuntimeExport(result.analysis, 'replaced').kind).toBe('present-unsupported');
  });

  test('invalidates only selected registration members, including writes through aliases', () => {
    const result = analyzeSource(
      '/src/tool.ts',
      new TextEncoder().encode(
        "export const tool = { name: 'find', parameters: {} }; const alias = tool; alias.parameters.type = 'string'; tool.description = 'new';",
      ),
      SOURCE_CONFIG,
    );
    if (result.kind !== 'valid') throw new TypeError('The source fixture must be valid.');
    expect(getConstExport(result.analysis, 'tool', ['name']).kind).toBe('present-supported');
    expect(getConstExport(result.analysis, 'tool', ['parameters']).kind).toBe(
      'present-unsupported',
    );
    expect(getConstExport(result.analysis, 'tool').kind).toBe('present-unsupported');
  });

  test('preserves the original object and callable when a separate alias is reassigned', () => {
    const result = analyzeSource(
      '/src/tool.ts',
      new TextEncoder().encode(
        "export const tool = { name: 'find', parameters: {} }; let selectedTool = tool; selectedTool = { name: 'other', parameters: {} }; export const loader = () => 'canonical'; let selectedLoader = loader; selectedLoader = () => 'other';",
      ),
      SOURCE_CONFIG,
    );
    if (result.kind !== 'valid') throw new TypeError('The source fixture must be valid.');
    expect(getConstExport(result.analysis, 'tool', ['name', 'parameters']).kind).toBe(
      'present-supported',
    );
    expect(getCallableExportState(result.analysis, 'loader').kind).toBe('present-supported');
  });

  // the large compiler fixture exceeds Vitest's default timeout on contended Windows runners
  test(
    'accounts for repeated member writes through a large alias chain and cycles',
    { timeout: 30_000 },
    () => {
      const count = 4096;
      const declarations = ["export const tool = { name: 'find', parameters: {} };"];
      for (let index = 1; index <= count; index += 1) {
        const target = index === 1 ? 'tool' : 'alias' + (index - 1);
        declarations.push(`const alias${index} = ${target}; alias${index}.parameters = {};`);
      }
      declarations.push(
        'const cycleA = cycleB; const cycleB = cycleA; cycleA.parameters = {}; cycleB.parameters = {};',
      );
      const result = analyzeSource(
        '/src/tool.ts',
        new TextEncoder().encode(declarations.join('\n')),
        SOURCE_CONFIG,
      );
      if (result.kind !== 'valid') throw new TypeError('The source fixture must be valid.');
      expect(result.analysis.bindingMutations.size).toBe(count + 3);
      expect(
        [...result.analysis.bindingMutations.values()].every((members) => members.size === 1),
      ).toBe(true);
      expect(getConstExport(result.analysis, 'tool', ['name']).kind).toBe('present-supported');
      expect(getConstExport(result.analysis, 'tool', ['parameters']).kind).toBe(
        'present-unsupported',
      );
    },
  );

  test('indexes a provider module without request analysis', () => {
    const result = analyzeTypeScriptModule(
      '/src/agent.ts',
      new TextEncoder().encode(
        [
          "import { Client as ProviderClient } from 'provider';",
          'const client = new ProviderClient();',
          'const tools = [tool];',
          'export const agent = client;',
        ].join('\n'),
      ),
      SOURCE_CONFIG.importConfig,
    );

    if (result.kind !== 'valid') {
      throw new TypeError('The source fixture must be valid.');
    }

    expect(result.analysis.clientNames).toStrictEqual(new Set(['client']));
    expect(result.analysis.moduleArrays.has('tools')).toBe(true);
    expect(result.analysis.safeModuleArrayNames).toStrictEqual(new Set());
  });

  test('indexes supported imports, clients, arrays, and direct exports', () => {
    const result = analyzeSource(
      '/src/agent.ts',
      new TextEncoder().encode(
        [
          "import { Client as ProviderClient } from 'provider';",
          'const client = new ProviderClient();',
          'const tools = [tool];',
          'export const schema = { type: `object` } as const;',
          'export const loadSystem = () => `system`;',
          'export const agent = () => client.messages.create({ tools });',
        ].join('\n'),
      ),
      SOURCE_CONFIG,
    );

    if (result.kind !== 'valid') {
      throw new TypeError('The source fixture must be valid.');
    }

    expect(result.analysis.constructorNames).toStrictEqual(new Set(['ProviderClient']));
    expect(result.analysis.clientNames).toStrictEqual(new Set(['client']));
    expect(result.analysis.safeModuleArrayNames).toStrictEqual(new Set(['tools']));
    expect(getRuntimeExport(result.analysis, 'agent').kind).toBe('present-supported');
    expect(getCallableExportState(result.analysis, 'loadSystem').kind).toBe('present-supported');
    expect(getConstExport(result.analysis, 'schema').kind).toBe('present-supported');
  });

  test('returns stable invalid-text and invalid-syntax states', () => {
    expect(analyzeSource('/src/agent.ts', Uint8Array.from([0xff]), SOURCE_CONFIG)).toStrictEqual({
      kind: 'invalid-text',
    });
    expect(
      analyzeSource('/src/agent.ts', new TextEncoder().encode('export const = ;'), SOURCE_CONFIG),
    ).toMatchObject({ kind: 'invalid-syntax' });
  });

  test.each([
    ['/src/agent.ts', true],
    ['/src/agent.tsx', true],
    ['/src/agent.mts', true],
    ['/src/agent.d.ts', false],
    ['/src/agent.d.tsx', false],
    ['/src/agent.d.mts', false],
    ['/src/agent.d.cts', false],
    ['/src/agent.js', false],
  ])('isSupportedTypeScriptSourcePath(%s) -> %s', (path, expected) => {
    expect(isSupportedTypeScriptSourcePath(path)).toBe(expected);
  });
});
