// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import { createCore } from '@moldea.ai/core';
import type { IAdapterDiagnostic } from '@moldea.ai/core/adapter';
import { parseRepositoryPath, type IRepositoryReader } from '@moldea.ai/repository';
import {
  createMemoryRepositoryReader,
  type IMemoryRepositoryEntry,
} from '@moldea.ai/repository/memory';

import { openAiAdapter } from '../adapter/index.js';
import { OPENAI_ADAPTER_DIAGNOSTICS } from '../diagnostics/index.js';

interface IOpenAiFixture {
  readonly entries: readonly {
    readonly path: string;
    readonly text: string;
    readonly type: 'file';
  }[];
  readonly manifest: string;
}

type IFixtureReplacement = string | Uint8Array;

const fixture = JSON.parse(
  readFileSync(new URL('../../../../fixtures/adapter-openai/cases.json', import.meta.url), 'utf8'),
) as IOpenAiFixture;
const shipmentFixture = JSON.parse(
  readFileSync(
    new URL('../../../../fixtures/adapter-openai/shipment-regression.json', import.meta.url),
    'utf8',
  ),
) as IOpenAiFixture;
const expectedEvidence = JSON.parse(
  readFileSync(
    new URL('../../../../fixtures/adapter-openai/evidence.expected.json', import.meta.url),
    'utf8',
  ),
) as readonly unknown[];
const expectedDiagnostics = JSON.parse(
  readFileSync(
    new URL('../../../../fixtures/adapter-openai/diagnostics.expected.json', import.meta.url),
    'utf8',
  ),
) as readonly { readonly code: string; readonly message: string }[];

const createEntries = (
  replacements: Readonly<Record<string, IFixtureReplacement>> = {},
): readonly IMemoryRepositoryEntry[] => [
  {
    content: replacements['/moldea/moldea.yaml'] ?? fixture.manifest,
    path: '/moldea/moldea.yaml',
    type: 'file',
  },
  ...fixture.entries.map((entry): IMemoryRepositoryEntry => ({
    content: replacements[entry.path] ?? entry.text,
    path: entry.path,
    type: 'file',
  })),
];

const inspectEntries = async (entries: readonly IMemoryRepositoryEntry[]) =>
  createCore({ adapters: [openAiAdapter] }).validateProject({
    repository: createMemoryRepositoryReader(entries),
  });

test.each([
  ['canonical shipment instruction', null, null, null],
  [
    'replaced request instruction',
    '/src/shipment-explainer/agent.ts',
    [
      'instructions: await loadShipmentExplainerInstruction()',
      "instructions: 'Use the wrong shipment policy'",
    ],
    'OPENAI_INSTRUCTION_LOADER_NOT_WIRED',
  ],
  [
    'loader reading another file',
    '/src/shipment-explainer/instructions.ts',
    ['../../moldea/agents/shipment-explainer/instruction.md', './wrong-instruction.md'],
    'OPENAI_INSTRUCTION_SOURCE_MISMATCH',
  ],
  [
    'wrong consumer alongside a correct consumer',
    '/src/shipment-explainer/agent.ts',
    [
      '  const response =',
      "  await client.responses.create({ model: validatedModel, instructions: 'Use the wrong shipment policy', input: 'Draft a response' });\n  const response =",
    ],
    'OPENAI_INSTRUCTION_LOADER_NOT_WIRED',
  ],
] as const)('inspects the copied shipment mock: %s', async (_scenario, path, replacement, code) => {
  const entries: IMemoryRepositoryEntry[] = [
    { path: '/moldea/moldea.yaml', type: 'file', content: shipmentFixture.manifest },
    ...shipmentFixture.entries.map((entry): IMemoryRepositoryEntry => ({
      path: entry.path,
      type: 'file',
      content:
        entry.path === path && replacement !== null
          ? entry.text.replace(replacement[0], replacement[1])
          : entry.text,
    })),
    {
      path: '/src/shipment-explainer/wrong-instruction.md',
      type: 'file',
      content: 'Use the wrong shipment policy.\n',
    },
  ];
  const result = await inspectEntries(entries);
  expect(result.valid).toBe(code === null);
  expect(result.errorCount).toBe(code === null ? 0 : 1);
  expect(result.warningCount).toBe(0);
  expect(result.runtimeInspection).toBe('complete');
  expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toStrictEqual(
    code === null ? [] : [code],
  );
});

const inspect = async (replacements: Readonly<Record<string, IFixtureReplacement>> = {}) =>
  inspectEntries(createEntries(replacements));

const inspectOutputSchema = async (
  format: string,
  options?: string,
  helperImport = '',
  outputSchema = "export const OutputSchema = { type: 'object' } as const;",
  otherFormats: readonly string[] = [],
) => {
  const agent = fixture.entries.find(({ path }) => path === '/src/agent.ts')?.text;
  const contracts = fixture.entries.find(({ path }) => path === '/src/contracts.ts')?.text;

  if (agent === undefined || contracts === undefined) {
    throw new TypeError('The output-schema fixture requires agent and contract sources.');
  }

  let runtime = agent
    .replace(
      "import OpenAIClient from 'openai';",
      `import OpenAIClient from 'openai';\n${helperImport}`,
    )
    .replace('  client.responses.create({', '  client.responses.parse({')
    .replace(
      "import { FindOrderInput } from './contracts.js';",
      "import { FindOrderInput, OutputSchema } from './contracts.js';",
    )
    .replace(
      '    tools: [registeredFindOrder],',
      `    tools: [registeredFindOrder],\n    text: { format: ${format} },`,
    )
    .replace('  });', `  }${options === undefined ? '' : `, ${options}`});`);

  if (otherFormats.length > 0) {
    const requests = otherFormats.map(
      (otherFormat) =>
        `  client.responses.parse({
    instructions: readInstruction(),
    tools: [registeredFindOrder],
    text: { format: ${otherFormat} },
  });`,
    );
    runtime = runtime
      .replace(
        'export const supportAgent = async () =>',
        'export const supportAgent = async () => {',
      )
      .replace('  });', `  });\n${requests.join('\n')}\n};`);
  }

  return inspect({
    '/moldea/moldea.yaml': fixture.manifest.replace(
      '    tools:',
      '      outputSchema:\n        path: /src/contracts.ts\n        symbol: OutputSchema\n    tools:',
    ),
    '/src/agent.ts': runtime,
    '/src/contracts.ts': `${contracts}\n${outputSchema}\n`,
  });
};

const createNullPrototypeRecord = <Value extends object>(value: Value): Value =>
  Object.assign(Object.create(null) as Value, value);

const createExpectedDiagnostic = (
  code: Exclude<keyof typeof OPENAI_ADAPTER_DIAGNOSTICS, 'OPENAI_RUNTIME_RELATIONSHIP_UNVERIFIED'>,
  path: string,
  range: IAdapterDiagnostic['range'],
  capabilityId?: string,
): IAdapterDiagnostic => ({
  code,
  details: createNullPrototypeRecord({}),
  entity: createNullPrototypeRecord({
    agentId: 'support',
    ...(capabilityId === undefined ? {} : { capabilityId, capabilityKind: 'tool' as const }),
    adapterId: 'openai',
  }),
  message: OPENAI_ADAPTER_DIAGNOSTICS[code].message,
  severity: 'error',
  path: parseRepositoryPath(path),
  pointer: null,
  range,
  source: 'openai',
});

describe('openAiAdapter Core integration', () => {
  test('reports the stable stream method without losing direct relationships', async () => {
    const source = fixture.entries.find(({ path }) => path === '/src/agent.ts')?.text;

    if (source === undefined) {
      throw new TypeError('The runtime source fixture is required.');
    }

    const result = await inspect({
      '/src/agent.ts': source.replace('client.responses.create(', 'client.responses.stream('),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(
      result.evidence
        .filter(({ kind }) => kind === 'runtime-pattern')
        .map(({ runtimeName }) => runtimeName),
    ).toStrictEqual(['responses.stream']);
    expect(result.evidence.map(({ kind }) => kind)).toContain('instruction-loader');
    expect(result.evidence.map(({ kind }) => kind)).toContain('tool-registration');
  });

  test.each([
    ['matching first', 'OutputSchema', '{}'],
    ['contradiction first', '{}', 'OutputSchema'],
  ])('preserves an output-schema contradiction with %s', async (_order, first, second) => {
    const result = await inspectOutputSchema(
      `{ type: 'json_schema', schema: ${first} }`,
      undefined,
      '',
      undefined,
      [`{ type: 'json_schema', schema: ${second} }`],
    );

    expect(result.valid).toBe(false);
    expect(
      result.diagnostics.filter(({ severity }) => severity === 'error').map(({ code }) => code),
    ).toStrictEqual(['OPENAI_OUTPUT_SCHEMA_NOT_WIRED']);
    expect(
      result.evidence.some(
        ({ kind, details }) => kind === 'schema' && details['schemaRole'] === 'output',
      ),
    ).toBe(false);
  });

  test('keeps a matching output schema unverified beside an unresolved consumer', async () => {
    const result = await inspectOutputSchema(
      "{ type: 'json_schema', schema: OutputSchema }",
      undefined,
      '',
      undefined,
      ['dynamicFormat'],
    );

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'OPENAI_RUNTIME_RELATIONSHIP_UNVERIFIED',
        details: { relationship: 'agent-output-schema', reason: 'dynamic-source-pattern' },
        severity: 'warning',
      }),
    );
    expect(
      result.evidence.some(
        ({ kind, details }) => kind === 'schema' && details['schemaRole'] === 'output',
      ),
    ).toBe(false);
  });

  test('does not trust a replaced SDK output-format helper', async () => {
    const result = await inspectOutputSchema(
      "zodTextFormat(OutputSchema, 'answer')",
      undefined,
      "import { zodTextFormat } from 'openai/helpers/zod';\nzodTextFormat = replacement;",
    );

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'OPENAI_RUNTIME_RELATIONSHIP_UNVERIFIED',
        details: { relationship: 'agent-output-schema', reason: 'dynamic-source-pattern' },
        severity: 'warning',
      }),
    );
    expect(
      result.evidence.some(
        ({ kind, details }) => kind === 'schema' && details['schemaRole'] === 'output',
      ),
    ).toBe(false);
  });

  test('establishes direct output-schema identity through the effective text format', async () => {
    const result = await inspectOutputSchema(
      "{ type: 'json_schema', name: 'answer', schema: OutputSchema }",
    );

    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.evidence).toContainEqual(
      expect.objectContaining({
        kind: 'schema',
        details: { requestProperty: 'text.format', schemaRole: 'output' },
      }),
    );
  });

  test('traces a direct zodTextFormat helper to its exact bound schema', async () => {
    const result = await inspectOutputSchema(
      "zodTextFormat(OutputSchema, 'answer')",
      undefined,
      "import { zodTextFormat } from 'openai/helpers/zod';",
      "import { z } from 'zod';\nexport const OutputSchema = z.object({ answer: z.string() });",
    );

    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.evidence).toContainEqual(
      expect.objectContaining({
        kind: 'schema',
        details: { requestProperty: 'text.format', schemaRole: 'output' },
      }),
    );
  });

  test('keeps transformed or non-SDK output helpers unverified', async () => {
    const transformed = await inspectOutputSchema(
      "wrap(zodTextFormat(OutputSchema, 'answer'))",
      undefined,
      "import { zodTextFormat } from 'openai/helpers/zod';",
    );
    const unrelated = await inspectOutputSchema(
      "zodTextFormat(OutputSchema, 'answer')",
      undefined,
      "import { zodTextFormat } from './local.js';",
    );

    for (const result of [transformed, unrelated]) {
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'OPENAI_RUNTIME_RELATIONSHIP_UNVERIFIED',
          details: { reason: 'dynamic-source-pattern', relationship: 'agent-output-schema' },
          severity: 'warning',
        }),
      );
      expect(
        result.evidence.some(
          ({ kind, details }) => kind === 'schema' && details['schemaRole'] === 'output',
        ),
      ).toBe(false);
    }
  });

  test('diagnoses a missing bound output-schema symbol', async () => {
    const result = await inspectOutputSchema(
      "{ type: 'json_schema', schema: OutputSchema }",
      undefined,
      '',
      '',
    );

    expect(result.diagnostics.map(({ code }) => code)).toContain(
      'OPENAI_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND',
    );
  });

  test('rejects a statically replaced output schema and warns for a dynamic body', async () => {
    const replaced = await inspectOutputSchema(
      "{ type: 'json_schema', name: 'answer', schema: OutputSchema }",
      "{ body: { text: { format: { type: 'json_schema', name: 'answer', schema: {} } } } }",
    );
    const dynamic = await inspectOutputSchema(
      "{ type: 'json_schema', name: 'answer', schema: OutputSchema }",
      '{ body: replacement }',
    );

    expect(replaced.diagnostics.map(({ code }) => code)).toContain(
      'OPENAI_OUTPUT_SCHEMA_NOT_WIRED',
    );
    expect(dynamic.diagnostics).toContainEqual(
      expect.objectContaining({
        details: { reason: 'dynamic-source-pattern', relationship: 'agent-output-schema' },
        severity: 'warning',
      }),
    );
    expect(
      dynamic.evidence.some(
        ({ kind, details }) => kind === 'schema' && details['schemaRole'] === 'output',
      ),
    ).toBe(false);
  });

  test('keeps the diagnostic catalog synchronized with its conformance golden', () => {
    expect(
      Object.entries(OPENAI_ADAPTER_DIAGNOSTICS)
        .map(([code, definition]) => ({ code, ...definition }))
        .sort((left, right) => (left.code < right.code ? -1 : left.code > right.code ? 1 : 0)),
    ).toStrictEqual(expectedDiagnostics);
  });

  test('emits the complete normalized evidence for the supported target', async () => {
    const result = await inspect();

    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.valid).toBe(true);
    // JSON goldens cannot encode Core's null-prototype details records.
    expect(result.evidence).toEqual(expectedEvidence);
    expect(result.summary).not.toBeNull();
  });

  test('accepts a later stable provider major through the minimum-only range', async () => {
    const result = await inspect({ '/package.json': '{"dependencies":{"openai":"8.0.0"}}' });

    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.valid).toBe(true);
  });

  test('produces identical evidence for reversed repository entry order', async () => {
    const result = await inspectEntries([...createEntries()].reverse());

    expect(result.valid).toBe(true);
    // JSON goldens cannot encode Core's null-prototype details records.
    expect(result.evidence).toEqual(expectedEvidence);
  });

  test.each([
    ['OPENAI_PACKAGE_MANIFEST_INVALID', '/package.json', '{', null, undefined],
    [
      'OPENAI_SDK_VERSION_UNSUPPORTED',
      '/package.json',
      '{"dependencies":{"openai":"7.3.0"}}',
      null,
      undefined,
    ],
    ['OPENAI_SOURCE_TEXT_INVALID', '/src/agent.ts', Uint8Array.from([0xff]), null, undefined],
    [
      'OPENAI_SOURCE_TEXT_INVALID',
      '/src/find-order.ts',
      Uint8Array.from([0xff]),
      null,
      'find-order',
    ],
    [
      'OPENAI_SOURCE_SYNTAX_INVALID',
      '/src/agent.ts',
      'export const supportAgent = (;',
      {
        end: { column: 31, line: 1, offset: 30 },
        start: { column: 30, line: 1, offset: 29 },
      },
      undefined,
    ],
    [
      'OPENAI_SOURCE_SYNTAX_INVALID',
      '/src/contracts.ts',
      'export const FindOrderInput = (;',
      {
        end: { column: 33, line: 1, offset: 32 },
        start: { column: 32, line: 1, offset: 31 },
      },
      'find-order',
    ],
    [
      'OPENAI_RUNTIME_AGENT_SYMBOL_NOT_FOUND',
      '/src/agent.ts',
      "import OpenAI from 'openai';\nconst client = new OpenAI();\nexport const anotherAgent = () => client.responses.create({ input: 'x' });\n",
      null,
      undefined,
    ],
    [
      'OPENAI_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND',
      '/src/instructions.ts',
      "export const anotherLoader = () => 'instruction';\n",
      null,
      undefined,
    ],
    [
      'OPENAI_TOOL_REGISTRATION_SYMBOL_NOT_FOUND',
      '/src/find-order.ts',
      'export const findOrder = async () => undefined;\nexport const anotherTool = {};\n',
      null,
      'find-order',
    ],
    [
      'OPENAI_INSTRUCTION_LOADER_NOT_WIRED',
      '/src/agent.ts',
      fixture.entries
        .find(({ path }) => path === '/src/agent.ts')
        ?.text.replace('instructions: readInstruction()', "instructions: 'static'") ?? '',
      {
        end: { column: 27, line: 12, offset: 380 },
        start: { column: 19, line: 12, offset: 372 },
      },
      undefined,
    ],
    [
      'OPENAI_TOOL_REGISTRATION_NOT_WIRED',
      '/src/agent.ts',
      fixture.entries
        .find(({ path }) => path === '/src/agent.ts')
        ?.text.replace('tools: [registeredFindOrder]', 'tools: []') ?? '',
      {
        end: { column: 14, line: 14, offset: 437 },
        start: { column: 12, line: 14, offset: 435 },
      },
      'find-order',
    ],
    [
      'OPENAI_TOOL_NAME_MISMATCH',
      '/src/find-order.ts',
      fixture.entries
        .find(({ path }) => path === '/src/find-order.ts')
        ?.text.replace("name: 'find_order'", "name: 'lookup_order'") ?? '',
      {
        end: { column: 23, line: 7, offset: 191 },
        start: { column: 9, line: 7, offset: 177 },
      },
      'find-order',
    ],
    [
      'OPENAI_TOOL_INPUT_SCHEMA_NOT_WIRED',
      '/src/find-order.ts',
      fixture.entries
        .find(({ path }) => path === '/src/find-order.ts')
        ?.text.replace('parameters: FindOrderInput', 'parameters: {}') ?? '',
      {
        end: { column: 17, line: 9, offset: 264 },
        start: { column: 15, line: 9, offset: 262 },
      },
      'find-order',
    ],
    [
      'OPENAI_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND',
      '/src/contracts.ts',
      'export const AnotherInput = {};\n',
      null,
      'find-order',
    ],
  ] as const)(
    'emits only %s with its exact normalized location and entity',
    async (expectedCode, path, replacement, range, capabilityId) => {
      const result = await inspect({ [path]: replacement });

      expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([
        createExpectedDiagnostic(expectedCode, path, range, capabilityId),
      ]);
      expect(
        result.diagnostics
          .filter(({ severity }) => severity === 'warning')
          .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
      ).toMatchSnapshot();
      expect(result.valid).toBe(false);
    },
  );

  test('reports an absent same-file input-schema symbol independently from registration shape', async () => {
    const registration = fixture.entries
      .find(({ path }) => path === '/src/find-order.ts')
      ?.text.replace("import { FindOrderInput } from './contracts.js';\n\n", '')
      .replace('parameters: FindOrderInput', 'parameters: MissingInput');

    if (registration === undefined) {
      throw new TypeError('The registration fixture is required.');
    }

    const result = await inspect({
      '/moldea/moldea.yaml': fixture.manifest.replace(
        'path: /src/contracts.ts\n          symbol: FindOrderInput',
        'path: /src/find-order.ts\n          symbol: MissingInput',
      ),
      '/src/find-order.ts': registration,
    });

    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([
      createExpectedDiagnostic(
        'OPENAI_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND',
        '/src/find-order.ts',
        null,
        'find-order',
      ),
    ]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.valid).toBe(false);
  });

  test('preserves package diagnostics independently from source-analysis failures', async () => {
    const result = await inspect({
      '/package.json': '{',
      '/src/find-order.ts': Uint8Array.from([0xff]),
    });

    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([
      createExpectedDiagnostic('OPENAI_PACKAGE_MANIFEST_INVALID', '/package.json', null),
      createExpectedDiagnostic(
        'OPENAI_SOURCE_TEXT_INVALID',
        '/src/find-order.ts',
        null,
        'find-order',
      ),
    ]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.valid).toBe(false);
  });

  test.each([
    ['invalid UTF-8', Uint8Array.from([0xff])],
    ['NUL', new TextEncoder().encode('{"dependencies":{}}\0')],
  ])(
    'maps a package manifest with %s only to the package diagnostic',
    async (_description, content) => {
      const result = await inspect({ '/package.json': content });

      expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([
        createExpectedDiagnostic('OPENAI_PACKAGE_MANIFEST_INVALID', '/package.json', null),
      ]);
      expect(
        result.diagnostics
          .filter(({ severity }) => severity === 'warning')
          .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
      ).toMatchSnapshot();
      expect(result.valid).toBe(false);
    },
  );

  test('returns no false runtime diagnostic when the bound pattern is indirect', async () => {
    const result = await inspect({
      '/src/agent.ts': [
        "import OpenAI from 'openai';",
        'const client = new OpenAI();',
        "const request = { input: 'x' };",
        'export const supportAgent = () => client.responses.create(request);',
      ].join('\n'),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.evidence.map(({ kind }) => kind)).toStrictEqual(['language', 'runtime-package']);
  });

  test('returns no runtime-pattern evidence for a shadowed OpenAI client', async () => {
    const result = await inspect({
      '/src/agent.ts': [
        "import OpenAI from 'openai';",
        'const client = new OpenAI();',
        'export const supportAgent = (client: OpenAI) =>',
        "  client.responses.create({ input: 'x' });",
      ].join('\n'),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.evidence.map(({ kind }) => kind)).toStrictEqual(['language', 'runtime-package']);
  });

  test('rejects instruction and tool evidence through shadowed imports', async () => {
    const result = await inspect({
      '/src/agent.ts': [
        "import OpenAI from 'openai';",
        "import { loadInstruction as readInstruction } from './instructions.js';",
        "import { registeredFindOrder } from './find-order.js';",
        'const client = new OpenAI();',
        'export const supportAgent = (readInstruction: () => string, registeredFindOrder: object) =>',
        '  client.responses.create({',
        '    instructions: readInstruction(),',
        '    tools: [registeredFindOrder],',
        '  });',
      ].join('\n'),
    });

    expect(result).toMatchObject({ valid: true, errorCount: 0, runtimeInspection: 'incomplete' });
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.evidence.map(({ kind }) => kind)).toStrictEqual([
      'language',
      'runtime-package',
      'runtime-pattern',
      'schema',
    ]);
  });

  test('preserves registration identity after only its input schema is mutated', async () => {
    const registration = fixture.entries.find(({ path }) => path === '/src/find-order.ts')?.text;
    if (registration === undefined) throw new TypeError('The registration fixture is required.');
    const result = await inspect({
      '/src/find-order.ts': `${registration}\nfindOrderTool.parameters = replacement;\n`,
    });

    expect(result.valid).toBe(true);
    expect(result.evidence.map(({ kind }) => kind)).toContain('tool-registration');
    expect(
      result.evidence.some(
        ({ kind, capabilityId }) => kind === 'schema' && capabilityId === 'find-order',
      ),
    ).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'OPENAI_RUNTIME_RELATIONSHIP_UNVERIFIED',
        details: { relationship: 'tool-input-schema', reason: 'unsupported-source-pattern' },
        severity: 'warning',
      }),
    );
  });

  test('does not compare the manifest description with the OpenAI tool description', async () => {
    const registration = fixture.entries
      .find(({ path }) => path === '/src/find-order.ts')
      ?.text.replace(
        "description: 'Retrieves one order by its identifier.'",
        "description: 'Provider-specific wording.'",
      );

    if (registration === undefined) {
      throw new TypeError('The registration fixture is required.');
    }

    const result = await inspect({ '/src/find-order.ts': registration });

    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.evidence.map(({ kind }) => kind)).toContain('tool-registration');
  });

  test('tolerates additional FunctionTool fields without interpreting their values', async () => {
    const registration = fixture.entries
      .find(({ path }) => path === '/src/find-order.ts')
      ?.text.replace(
        '  strict: true,\n',
        [
          '  strict: true,',
          '  allowed_callers: resolveAllowedCallers(),',
          '  defer_loading: shouldDeferLoading(),',
          '  output_schema: buildOutputSchema(),',
          '',
        ].join('\n'),
      );

    if (registration === undefined) {
      throw new TypeError('The registration fixture is required.');
    }

    const result = await inspect({ '/src/find-order.ts': registration });

    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.evidence.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(['schema', 'tool-registration']),
    );
  });

  test.each([
    ['an unknown property', '  unsupported_property: true,\n'],
    ['a shorthand property', '  allowed_callers,\n'],
    ['a computed property', "  ['allowed_callers']: [],\n"],
    ['a spread property', '  ...additionalProperties,\n'],
    ['a method', '  allowed_callers() { return []; },\n'],
    ['a getter', '  get allowed_callers() { return []; },\n'],
    ['a setter', '  set allowed_callers(value) {},\n'],
  ])('silently leaves a FunctionTool with %s unsupported', async (_description, property) => {
    const registration = fixture.entries
      .find(({ path }) => path === '/src/find-order.ts')
      ?.text.replace('  strict: true,\n', `  strict: true,\n${property}`);

    if (registration === undefined) {
      throw new TypeError('The registration fixture is required.');
    }

    const result = await inspect({ '/src/find-order.ts': registration });

    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(
      result.evidence.some(({ kind }) => kind === 'schema' || kind === 'tool-registration'),
    ).toBe(false);
  });

  test('silently leaves a present but unsupported input-schema symbol unestablished', async () => {
    const result = await inspect({
      '/src/contracts.ts': 'export function FindOrderInput() { return {}; }\n',
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.evidence.map(({ kind }) => kind)).not.toContain('schema');
    expect(result.evidence.map(({ kind }) => kind)).toContain('tool-registration');
  });

  test('keeps dynamic input schemas unverified while proving registration identity', async () => {
    const registration = fixture.entries
      .find(({ path }) => path === '/src/find-order.ts')
      ?.text.replace(
        'export const findOrder = async',
        'const DynamicInput = buildSchema();\n\nexport const findOrder = async',
      )
      .replace('parameters: FindOrderInput', 'parameters: DynamicInput');

    if (registration === undefined) {
      throw new TypeError('The registration fixture is required.');
    }

    const result = await inspect({ '/src/find-order.ts': registration });

    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.evidence.some(({ kind }) => kind === 'schema')).toBe(false);
    expect(result.evidence.map(({ kind }) => kind)).toContain('tool-registration');
  });

  test('ignores unrelated dynamic request properties for both relationships', async () => {
    const agent = fixture.entries
      .find(({ path }) => path === '/src/agent.ts')
      ?.text.replace("model: 'gpt-5'", 'model: selectModel()');

    if (agent === undefined) {
      throw new TypeError('The runtime-agent fixture is required.');
    }

    const result = await inspect({ '/src/agent.ts': agent });

    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.evidence.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(['instruction-loader', 'tool-registration']),
    );
  });

  test('keeps ambiguity local to the affected request relationship', async () => {
    const result = await inspect({
      '/src/agent.ts': [
        "import OpenAI from 'openai';",
        "import { findOrderTool as registeredFindOrder } from './find-order.js';",
        "import { loadInstruction as readInstruction } from './instructions.js';",
        'const client = new OpenAI();',
        'export const supportAgent = () =>',
        '  client.responses.create({',
        '    instructions: readInstruction(),',
        '    [dynamicKey]: dynamicValue,',
        '    tools: [registeredFindOrder],',
        '  });',
      ].join('\n'),
    });

    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.valid).toBe(true);
    expect(
      result.diagnostics
        .filter(({ details }) => details['relationship'] !== 'tool-implementation')
        .map(({ code, details, severity }) => ({ code, details, severity })),
    ).toStrictEqual([
      {
        code: 'OPENAI_RUNTIME_RELATIONSHIP_UNVERIFIED',
        details: { reason: 'dynamic-source-pattern', relationship: 'instruction-loader' },
        severity: 'warning',
      },
    ]);
    expect(result.evidence.map(({ kind }) => kind)).not.toContain('instruction-loader');
    expect(result.evidence.map(({ kind }) => kind)).toContain('tool-registration');
  });

  test('emits a negative diagnostic despite an unrelated dynamic request property', async () => {
    const result = await inspect({
      '/src/agent.ts': [
        "import OpenAI from 'openai';",
        "import { findOrderTool as registeredFindOrder } from './find-order.js';",
        "import { loadInstruction as readInstruction } from './instructions.js';",
        'const client = new OpenAI();',
        'export const supportAgent = () =>',
        '  client.responses.create({',
        "    instructions: 'static',",
        '    model: selectModel(),',
        '    tools: [registeredFindOrder],',
        '  });',
      ].join('\n'),
    });

    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(
      result.diagnostics.filter(({ severity }) => severity === 'error').map(({ code }) => code),
    ).toStrictEqual(['OPENAI_INSTRUCTION_LOADER_NOT_WIRED']);
    expect(result.evidence.map(({ kind }) => kind)).toContain('tool-registration');
  });

  test('preserves known instruction contradictions beside matching and unresolved requests', async () => {
    const result = await inspect({
      '/src/agent.ts': [
        "import OpenAI from 'openai';",
        "import { findOrderTool as registeredFindOrder } from './find-order.js';",
        "import { loadInstruction as readInstruction } from './instructions.js';",
        'const client = new OpenAI();',
        'const tools = [registeredFindOrder];',
        'export const supportAgent = async () => {',
        "  await client.responses.create({ instructions: 'static', tools: [] });",
        '  await client.responses.create({ instructions: await readInstruction(), tools });',
        '  return client.responses.create({ ...dynamicRequest });',
        '};',
      ].join('\n'),
    });

    expect(result.valid).toBe(false);
    expect(
      result.diagnostics.filter(({ severity }) => severity === 'error').map(({ code }) => code),
    ).toStrictEqual(['OPENAI_INSTRUCTION_LOADER_NOT_WIRED']);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.evidence.map(({ kind }) => kind)).not.toContain('instruction-loader');
    expect(result.evidence.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(['runtime-pattern', 'tool-registration']),
    );
  });

  test('accepts additional statically resolvable OpenAI registrations in a closed tool array', async () => {
    const entries = createEntries({
      '/src/agent.ts': [
        "import OpenAI from 'openai';",
        "import { extraTool } from './extra-tool.js';",
        "import { findOrderTool as registeredFindOrder } from './find-order.js';",
        "import { loadInstruction as readInstruction } from './instructions.js';",
        'const client = new OpenAI();',
        'export const supportAgent = () =>',
        '  client.responses.create({',
        '    instructions: readInstruction(),',
        '    tools: [registeredFindOrder, extraTool],',
        '  });',
      ].join('\n'),
    });
    const result = await inspectEntries([
      ...entries,
      {
        content: [
          'export const extraTool = {',
          "  type: 'function',",
          "  name: 'extra_tool',",
          '  parameters: {},',
          '  strict: null,',
          '} as const;',
        ].join('\n'),
        path: '/src/extra-tool.ts',
        type: 'file',
      },
    ]);

    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.evidence.map(({ kind }) => kind)).toContain('tool-registration');
  });

  test('preserves known instruction errors beside unresolved request candidates', async () => {
    const closedResult = await inspect({
      '/src/agent.ts': [
        "import OpenAI from 'openai';",
        "import { findOrderTool as registeredFindOrder } from './find-order.js';",
        "import { loadInstruction as readInstruction } from './instructions.js';",
        'const client = new OpenAI();',
        'export const supportAgent = async () => {',
        "  await client.responses.create({ instructions: 'static', tools: [] });",
        '  return client.responses.create({ input: 1 });',
        '};',
        'void registeredFindOrder;',
        'void readInstruction;',
      ].join('\n'),
    });
    const ambiguousResult = await inspect({
      '/src/agent.ts': [
        "import OpenAI from 'openai';",
        "import { findOrderTool as registeredFindOrder } from './find-order.js';",
        "import { loadInstruction as readInstruction } from './instructions.js';",
        'const client = new OpenAI();',
        'export const supportAgent = async () => {',
        '  await client.responses.create({ input: 1 });',
        '  return client.responses.create({ ...dynamicRequest });',
        '};',
        'void registeredFindOrder;',
        'void readInstruction;',
      ].join('\n'),
    });

    expect(
      ambiguousResult.diagnostics
        .filter(({ severity }) => severity === 'error')
        .map(({ code }) => code),
    ).toStrictEqual(['OPENAI_INSTRUCTION_LOADER_NOT_WIRED']);
    expect(
      closedResult.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(
      ambiguousResult.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(
      closedResult.diagnostics
        .filter(({ severity }) => severity === 'error')
        .map(({ code }) => code),
    ).toStrictEqual(['OPENAI_INSTRUCTION_LOADER_NOT_WIRED', 'OPENAI_TOOL_REGISTRATION_NOT_WIRED']);
    expect(ambiguousResult.valid).toBe(false);
    expect(
      ambiguousResult.diagnostics
        .filter(
          ({ severity, details }) =>
            severity === 'warning' && details['relationship'] !== 'tool-implementation',
        )
        .map(({ details, severity }) => ({ details, severity })),
    ).toStrictEqual([
      {
        details: { reason: 'dynamic-source-pattern', relationship: 'instruction-loader' },
        severity: 'warning',
      },
      {
        details: { reason: 'dynamic-source-pattern', relationship: 'tool-registration' },
        severity: 'warning',
      },
    ]);
  });

  test('preserves known instruction errors beside an aliased Responses candidate', async () => {
    const result = await inspect({
      '/src/agent.ts': [
        "import OpenAI from 'openai';",
        "import { findOrderTool as registeredFindOrder } from './find-order.js';",
        "import { loadInstruction as readInstruction } from './instructions.js';",
        'const client = new OpenAI();',
        'export const supportAgent = () => {',
        '  client.responses.create({ input: 1 });',
        '  const responses = client.responses;',
        '  return responses.create({',
        '    instructions: readInstruction(),',
        '    tools: [registeredFindOrder],',
        '  });',
        '};',
      ].join('\n'),
    });

    expect(
      result.diagnostics.filter(({ severity }) => severity === 'error').map(({ code }) => code),
    ).toStrictEqual(['OPENAI_INSTRUCTION_LOADER_NOT_WIRED']);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(
      result.diagnostics
        .filter(
          ({ severity, details }) =>
            severity === 'warning' && details['relationship'] !== 'tool-implementation',
        )
        .map(({ details, severity }) => ({ details, severity })),
    ).toStrictEqual([
      {
        details: { reason: 'dynamic-source-pattern', relationship: 'instruction-loader' },
        severity: 'warning',
      },
      {
        details: { reason: 'dynamic-source-pattern', relationship: 'tool-registration' },
        severity: 'warning',
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.evidence.map(({ kind }) => kind)).not.toContain('instruction-loader');
    expect(result.evidence.map(({ kind }) => kind)).not.toContain('tool-registration');
  });

  test.each([
    ['concise-arrow return', 'const exposeTools = () => tools;'],
    ['destructured member mutation', '({ next: tools[0] } = source);'],
  ])('does not trust a module tool array after a %s', async (_description, unsafeUse) => {
    const result = await inspect({
      '/src/agent.ts': [
        "import OpenAI from 'openai';",
        "import { findOrderTool as registeredFindOrder } from './find-order.js';",
        "import { loadInstruction as readInstruction } from './instructions.js';",
        'const client = new OpenAI();',
        'const tools = [registeredFindOrder];',
        unsafeUse,
        'export const supportAgent = () =>',
        '  client.responses.create({ instructions: readInstruction(), tools });',
      ].join('\n'),
    });

    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(
      result.diagnostics
        .filter(({ details }) => details['relationship'] !== 'tool-implementation')
        .map(({ details, severity }) => ({ details, severity })),
    ).toStrictEqual([
      {
        details: { reason: 'dynamic-source-pattern', relationship: 'tool-registration' },
        severity: 'warning',
      },
    ]);
    expect(result.valid).toBe(true);
    expect(result.evidence.map(({ kind }) => kind)).not.toContain('tool-registration');
  });

  test('emits package and language evidence when the runtime binding omits a symbol', async () => {
    const result = await inspect({
      '/moldea/moldea.yaml': fixture.manifest.replace('        symbol: supportAgent\n', ''),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.evidence.map(({ kind }) => kind)).toStrictEqual(['language', 'runtime-package']);
    expect(result.evidence.find(({ kind }) => kind === 'language')?.references).toStrictEqual([
      { path: '/src/agent.ts' },
    ]);
  });

  test('keeps package detection independent from the supported source-language target', async () => {
    const manifest = fixture.manifest.replaceAll('/src/agent.ts', '/src/agent.js');
    const result = await inspectEntries([
      ...createEntries({ '/moldea/moldea.yaml': manifest }),
      {
        content: 'export const supportAgent = () => undefined;\n',
        path: '/src/agent.js',
        type: 'file',
      },
    ]);

    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.evidence.map(({ kind }) => kind)).toStrictEqual(['runtime-package']);
  });

  test('silently ignores a present but unsupported runtime symbol form', async () => {
    const result = await inspect({
      '/src/agent.ts': 'export class supportAgent {}\n',
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.evidence.map(({ kind }) => kind)).toStrictEqual(['language', 'runtime-package']);
  });

  test('emits one agent-scoped package observation per supported declaration', async () => {
    const result = await inspect({
      '/package.json': JSON.stringify({
        dependencies: { openai: '^7.4.0' },
        peerDependencies: { openai: '>=7.4.0 <8.0.0' },
      }),
    });
    const packageEvidence = result.evidence.filter(({ kind }) => kind === 'runtime-package');

    expect(packageEvidence).toHaveLength(2);
    expect(packageEvidence.map(({ agentId, details }) => ({ agentId, details }))).toEqual(
      expect.arrayContaining([
        {
          agentId: 'support',
          details: {
            compatibility: 'supported',
            declaredRange: '^7.4.0',
            dependencyKind: 'dependencies',
          },
        },
        {
          agentId: 'support',
          details: {
            compatibility: 'supported',
            declaredRange: '>=7.4.0 <8.0.0',
            dependencyKind: 'peerDependencies',
          },
        },
      ]),
    );
  });

  test('emits one unsupported-range diagnostic without package evidence', async () => {
    const result = await inspect({
      '/package.json': JSON.stringify({
        dependencies: { openai: '7.3.0' },
        peerDependencies: { openai: '<7.0.0' },
      }),
    });

    expect(result.diagnostics.map(({ code }) => code)).toContain('OPENAI_SDK_VERSION_UNSUPPORTED');
    expect(result.evidence.some(({ kind }) => kind === 'runtime-package')).toBe(false);
  });

  test('keeps shared-source evidence agent-scoped while reusing source and package reads', async () => {
    const entries: readonly IMemoryRepositoryEntry[] = [
      {
        content: [
          'version: 1',
          'agents:',
          '  alpha:',
          '    runtime:',
          '      id: openai',
          '    bindings:',
          '      runtimeAgent:',
          '        path: /src/agent.ts',
          '        symbol: sharedAgent',
          '  beta:',
          '    runtime:',
          '      id: openai',
          '    bindings:',
          '      runtimeAgent:',
          '        path: /src/agent.ts',
          '        symbol: sharedAgent',
          '',
        ].join('\n'),
        path: '/moldea/moldea.yaml',
        type: 'file',
      },
      { content: '# Shared source\n', path: '/moldea/project.md', type: 'file' },
      {
        content: 'Alpha agent.\n',
        path: '/moldea/agents/alpha/description.md',
        type: 'file',
      },
      {
        content: 'You are the `alpha` agent.\n',
        path: '/moldea/agents/alpha/instruction.md',
        type: 'file',
      },
      {
        content: 'Beta agent.\n',
        path: '/moldea/agents/beta/description.md',
        type: 'file',
      },
      {
        content: 'You are the `beta` agent.\n',
        path: '/moldea/agents/beta/instruction.md',
        type: 'file',
      },
      {
        content: JSON.stringify({ dependencies: { openai: '^7.4.0' } }),
        path: '/package.json',
        type: 'file',
      },
      {
        content: [
          "import OpenAI from 'openai';",
          'const client = new OpenAI();',
          'export const sharedAgent = () => client.responses.create({ input: 1 });',
        ].join('\n'),
        path: '/src/agent.ts',
        type: 'file',
      },
    ];
    const memoryRepository = createMemoryRepositoryReader(entries);
    const readCounts = new Map<string, number>();
    const repository: IRepositoryReader = {
      snapshot: memoryRepository.snapshot,
      compare: (candidate, options) => memoryRepository.compare(candidate, options),
      getEntry: (path, options) => memoryRepository.getEntry(path, options),
      listEntriesPage: (options) => memoryRepository.listEntriesPage(options),
      readFilePage: async (path, options) => {
        readCounts.set(path, (readCounts.get(path) ?? 0) + 1);
        return memoryRepository.readFilePage(path, options);
      },
    };
    const result = await createCore({ adapters: [openAiAdapter] }).validateProject({ repository });
    const packageEvidence = result.evidence.filter(({ kind }) => kind === 'runtime-package');

    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(result.valid).toBe(true);
    expect(packageEvidence.map(({ agentId }) => agentId)).toStrictEqual(['alpha', 'beta']);
    expect(readCounts.get('/package.json')).toBe(1);
    expect(readCounts.get('/src/agent.ts')).toBe(1);
  });

  test('suppresses derived tool evidence for an unsupported registration shape', async () => {
    const registration = fixture.entries
      .find(({ path }) => path === '/src/find-order.ts')
      ?.text.replace('  strict: true,\n', '');

    if (registration === undefined) {
      throw new TypeError('The registration fixture is required.');
    }

    const result = await inspect({ '/src/find-order.ts': registration });

    expect(result.valid).toBe(true);
    expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toStrictEqual([]);
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === 'warning')
        .map(({ code, path, entity, details }) => ({ code, path, entity, details })),
    ).toMatchSnapshot();
    expect(
      result.evidence.some(({ kind }) => kind === 'schema' || kind === 'tool-registration'),
    ).toBe(false);
  });

  test('supports concurrent inspections with one immutable adapter singleton', async () => {
    const results = await Promise.all([inspect(), inspect(), inspect(), inspect()]);

    expect(results.every(({ valid }) => valid)).toBe(true);
    // JSON goldens cannot encode Core's null-prototype details records.
    expect(results.map(({ evidence }) => evidence)).toEqual([
      expectedEvidence,
      expectedEvidence,
      expectedEvidence,
      expectedEvidence,
    ]);
  });

  test('propagates cancellation without returning partial evidence', async () => {
    const controller = new AbortController();
    controller.abort(new Error('test cancellation'));

    await expect(
      createCore({ adapters: [openAiAdapter] }).validateProject({
        repository: createMemoryRepositoryReader(createEntries()),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: 'ABORTED' });
  });
});
