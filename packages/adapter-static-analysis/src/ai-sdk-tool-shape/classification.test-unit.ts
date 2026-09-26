// @vitest-environment node
import ts from 'typescript';
import { describe, expect, test } from 'vitest';

import { classifyAiSdkDeferredLoading, classifyAiSdkFunctionToolShape } from './index.js';

const classify = (source: string) => {
  const file = ts.createSourceFile(
    'tool.ts',
    `const tool = ${source};`,
    ts.ScriptTarget.Latest,
    true,
  );
  const statement = file.statements[0];

  if (!statement || !ts.isVariableStatement(statement)) {
    throw new TypeError('The tool fixture must declare a variable.');
  }

  const object = statement.declarationList.declarations[0]?.initializer;

  if (!object || !ts.isObjectLiteralExpression(object)) {
    throw new TypeError('The tool fixture must have an object initializer.');
  }

  return classifyAiSdkFunctionToolShape(object);
};

describe('AI SDK function-tool shape', () => {
  test.each([
    ['{ inputSchema: Input, execute }', null],
    ['{ inputSchema: Input, deferLoading: false, execute }', 'false'],
    ['{ inputSchema: Input, deferLoading: true, execute }', 'true'],
    ['{ inputSchema: Input, deferLoading, execute }', 'deferLoading'],
  ])('retains deferred-loading source from %s', (source, deferredText) => {
    const shape = classify(source);
    expect(shape).not.toBeNull();
    expect(shape?.deferLoading?.getText() ?? null).toBe(deferredText);
    expect(classifyAiSdkDeferredLoading(shape?.deferLoading ?? null)).toBe(
      deferredText === null
        ? 'absent'
        : deferredText === 'true'
          ? 'enabled'
          : deferredText === 'deferLoading'
            ? 'unknown'
            : 'disabled',
    );
  });

  test.each([
    '{ execute }',
    '{ inputSchema: Input, inputSchema: Other }',
    '{ inputSchema: Input, type: "provider-defined" }',
    '{ inputSchema: Input, ...other }',
    '{ inputSchema: Input, deferLoading: true, deferLoading: false }',
  ])('rejects unsupported function-tool shape %s', (source) => {
    expect(classify(source)).toBeNull();
  });
});
