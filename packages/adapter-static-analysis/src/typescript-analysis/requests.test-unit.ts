// @vitest-environment node
import ts from 'typescript';
import { describe, expect, test } from 'vitest';

import type { IStaticAnalysisSourceConfig } from '../types.js';
import { analyzeClientRequests, analyzeObjectRelationships } from './requests.js';
import { analyzeSource, getRuntimeExport } from './source-analysis.js';

const SOURCE_CONFIG: IStaticAnalysisSourceConfig = {
  importConfig: {
    namedConstructorImports: ['Client'],
    packageName: 'provider',
    supportsDefaultConstructorImport: true,
  },
  requestConfig: {
    acceptedArgumentCounts: [1, 2],
    methodNames: ['create', 'parse', 'stream'],
    relationshipNames: ['system', 'tools'],
    resourceName: 'messages',
    toolRelationshipName: 'tools',
  },
};

/** Analyzes requests in one supported exported runtime fixture. */
const analyzeRequests = (source: string) => {
  const result = analyzeSource('/src/agent.ts', new TextEncoder().encode(source), SOURCE_CONFIG);

  if (result.kind !== 'valid') {
    throw new TypeError('The request fixture must contain valid source.');
  }

  const runtime = getRuntimeExport(result.analysis, 'agent');

  if (runtime.kind !== 'present-supported' || runtime.body === undefined) {
    throw new TypeError('The request fixture must contain a supported runtime export.');
  }

  return analyzeClientRequests(result.analysis, runtime.body, SOURCE_CONFIG.requestConfig);
};

describe('static provider requests', () => {
  test('classifies nested object relationships independently', () => {
    const sourceFile = ts.createSourceFile(
      '/src/config.ts',
      '({ systemInstruction: load(), ...dynamic, tools: [tool] })',
      ts.ScriptTarget.ES2023,
      true,
      ts.ScriptKind.TS,
    );
    const expressionStatement = sourceFile.statements[0];

    if (
      expressionStatement === undefined ||
      !ts.isExpressionStatement(expressionStatement) ||
      !ts.isParenthesizedExpression(expressionStatement.expression) ||
      !ts.isObjectLiteralExpression(expressionStatement.expression.expression)
    ) {
      throw new TypeError('The nested relationship fixture must contain an object literal.');
    }

    const result = analyzeObjectRelationships(expressionStatement.expression.expression, [
      'systemInstruction',
      'tools',
    ]);

    expect({
      systemInstruction: result.relationships.get('systemInstruction')?.kind,
      tools: result.relationships.get('tools')?.kind,
    }).toStrictEqual({ systemInstruction: 'unresolved', tools: 'present' });
  });

  test('recognizes direct calls and keeps relationship closure independent', () => {
    const result = analyzeRequests(
      [
        "import Client from 'provider';",
        'const client = new Client();',
        'export const agent = () => {',
        '  client.messages.create({ system: loadSystem(), tools: [tool] });',
        '  return client.messages.create({ ...request, tools: [tool] }, { signal });',
        '};',
      ].join('\n'),
    );

    expect(result.hasAmbiguousCandidate).toBe(false);
    expect(
      result.requests.map(({ relationships }) => ({
        system: relationships.get('system')?.kind,
        tools: relationships.get('tools')?.kind,
      })),
    ).toStrictEqual([
      { system: 'present', tools: 'present' },
      { system: 'unresolved', tools: 'present' },
    ]);
  });

  test('preserves mixed method calls and options in one request traversal', () => {
    const result = analyzeRequests(
      [
        "import Client from 'provider';",
        'const client = new Client();',
        'export const agent = () => {',
        '  client.messages.create({ system: loadSystem() });',
        '  client.messages.parse({ tools: [tool] }, { timeout: 1000 });',
        '  return client.messages.stream({ system: loadSystem(), tools: [tool] });',
        '};',
      ].join('\n'),
    );

    expect(result.hasAmbiguousCandidate).toBe(false);
    expect(
      result.requests.map(({ call, methodName, object, options }) => ({
        methodName,
        callText: call.expression.getText(),
        objectText: object.getText(),
        optionsText: options?.getText() ?? null,
      })),
    ).toStrictEqual([
      {
        methodName: 'create',
        callText: 'client.messages.create',
        objectText: '{ system: loadSystem() }',
        optionsText: null,
      },
      {
        methodName: 'parse',
        callText: 'client.messages.parse',
        objectText: '{ tools: [tool] }',
        optionsText: '{ timeout: 1000 }',
      },
      {
        methodName: 'stream',
        callText: 'client.messages.stream',
        objectText: '{ system: loadSystem(), tools: [tool] }',
        optionsText: null,
      },
    ]);
  });

  test('keeps a module tool array safe when a direct options body replaces the request', () => {
    const result = analyzeSource(
      '/src/agent.ts',
      new TextEncoder().encode(
        [
          "import Client from 'provider';",
          'const client = new Client();',
          'const tools = [tool];',
          'export const agent = () => client.messages.parse({}, { body: { tools } });',
        ].join('\n'),
      ),
      SOURCE_CONFIG,
    );

    if (result.kind !== 'valid') {
      throw new TypeError('The request fixture must contain valid source.');
    }

    expect(result.analysis.safeModuleArrayNames.has('tools')).toBe(true);
  });

  test('recognizes shorthand relationship properties as direct identifier values', () => {
    const result = analyzeRequests(
      [
        "import Client from 'provider';",
        'const client = new Client();',
        'const system = loadSystem();',
        'const tools = [tool];',
        'export const agent = () => client.messages.create({ system, tools });',
      ].join('\n'),
    );

    expect(
      result.requests.map(({ relationships }) => ({
        system: relationships.get('system')?.kind,
        tools: relationships.get('tools')?.kind,
      })),
    ).toStrictEqual([{ system: 'present', tools: 'present' }]);
  });

  test.each([
    ['a dynamic request', 'return client.messages.create(request);'],
    ['an extracted resource', 'const messages = client.messages; return messages.create({});'],
    ['an escaped client', 'return client;'],
  ])('marks %s as ambiguous', (_description, statement) => {
    const result = analyzeRequests(
      [
        "import Client from 'provider';",
        'const client = new Client();',
        `export const agent = () => { ${statement} };`,
      ].join('\n'),
    );

    expect(result.hasAmbiguousCandidate).toBe(true);
  });

  test('ignores direct calls inside nested lexical boundaries', () => {
    const result = analyzeRequests(
      [
        "import Client from 'provider';",
        'const client = new Client();',
        'export const agent = () => {',
        '  const nested = () => client.messages.create({ system: loadSystem() });',
        '  return nested;',
        '};',
      ].join('\n'),
    );

    expect(result).toStrictEqual({ hasAmbiguousCandidate: false, requests: [] });
  });
});
