import { z } from 'zod';

// schema 7 is a closed envelope; command results validate only the fields consumed below
export const CliEnvelope = z.strictObject({
  cliVersion: z.string(),
  command: z.enum(['validate', 'inspect', 'scope', 'content', 'composition']),
  schemaVersion: z.literal(7),
  status: z.enum(['valid', 'invalid', 'error']),
  error: z
    .object({
      source: z.string(),
      code: z.string(),
      message: z.string(),
      path: z.string().nullable(),
      retryable: z.boolean(),
    })
    .catchall(z.json())
    .nullable(),
  result: z.unknown(),
});
export type ICliEnvelope = z.infer<typeof CliEnvelope>;

const CliEntity = z.strictObject({
  agentId: z.string().optional(),
  capabilityId: z.string().optional(),
  capabilityKind: z.enum(['tool', 'skill']).optional(),
  decisionId: z.string().optional(),
  variableId: z.string().optional(),
  contextPath: z.string().optional(),
  integrationPath: z.string().optional(),
});
const CliDiagnosticFields = {
  code: z.string(),
  group: z.enum(['discovery', 'manifest', 'references', 'agents', 'mirrors', 'integration']),
  entity: CliEntity.nullable(),
  key: z.string(),
  kind: z.literal('diagnostic'),
  message: z.string(),
  path: z.string().nullable(),
  pointer: z.string().nullable(),
  range: z
    .object({
      start: z.object({ line: z.number(), column: z.number(), offset: z.number() }),
      end: z.object({ line: z.number(), column: z.number(), offset: z.number() }),
    })
    .nullable(),
  source: z.string(),
};
const CliDiagnosticRecord = z.union([
  z.strictObject({ ...CliDiagnosticFields, severity: z.literal('error') }),
  z.strictObject({
    ...CliDiagnosticFields,
    severity: z.literal('warning'),
    subject: z.string(),
    qualifier: z.string().nullable(),
    acceptable: z.boolean(),
    accepted: z.boolean(),
    reason: z.string().nullable(),
  }),
]);
const CliCoverageFields = {
  entity: CliEntity,
  relationship: z.enum([
    'runtime-agent',
    'instruction-loader',
    'agent-input-schema',
    'agent-output-schema',
    'variable-provider',
    'tool-implementation',
    'tool-registration',
    'tool-input-schema',
    'tool-output-schema',
    'skill-implementation',
    'skill-registration',
    'context-binding',
    'decision-binding',
  ]),
  kind: z.literal('coverage'),
  key: z.string(),
  path: z.string(),
  symbol: z.string().nullable(),
  fileCheck: z.literal('passed'),
};
const CliCoverageRecord = z.discriminatedUnion('exportCheck', [
  z.strictObject({ ...CliCoverageFields, exportCheck: z.literal('passed') }),
  z.strictObject({ ...CliCoverageFields, exportCheck: z.literal('failed') }),
  z.strictObject({
    ...CliCoverageFields,
    exportCheck: z.literal('not-checked'),
    exportNotCheckedReason: z.enum([
      'no-symbol',
      'unsupported-file-type',
      'unresolved-exports',
      'unparseable-source',
      'resource-limit',
    ]),
  }),
]);
const CliAgentRecord = z.strictObject({
  agentId: z.string(),
  key: z.string(),
  kind: z.literal('agent'),
  runtimeId: z.string(),
});
const CliMetadataRecord = z.strictObject({
  agentId: z.string().nullable(),
  byteLength: z.number().int().nonnegative(),
  canonicalDigest: z.string().nullable(),
  decisionId: z.string().nullable(),
  digest: z.string(),
  key: z.string(),
  kind: z.literal('metadata'),
  metadataKind: z.enum([
    'agent-description',
    'agent-handoff-description',
    'agent-instruction',
    'context',
    'decision',
    'manifest',
    'mirror',
    'project',
    'runtime-guidance',
  ]),
  path: z.string(),
  scalarLength: z.number().int().nonnegative().nullable(),
});
const CliMatchRecord = z.strictObject({
  key: z.string(),
  kind: z.literal('match'),
  match: z.strictObject({
    inputPath: z.string(),
    field: z.enum([
      'affectedBy',
      'bindings',
      'implementation',
      'inputSchema',
      'instructionLoader',
      'mirrors',
      'outputSchema',
      'registration',
      'related',
      'runtimeAgent',
      'variableProvider',
    ]),
    pointer: z.string(),
    owner: z.strictObject({
      kind: z.enum(['agent', 'context', 'decision', 'skill', 'tool', 'unresolved']),
      id: z.string(),
      agentId: z.string().nullable(),
    }),
    declaration: z.union([
      z.strictObject({ kind: z.literal('exact'), path: z.string(), symbol: z.string().nullable() }),
      z.strictObject({ kind: z.literal('glob'), pattern: z.string() }),
    ]),
  }),
});

// the selected schema 7 collection fields are closed so misplaced counts cannot disappear
export const CliCollectionResult = z.strictObject({
  valid: z.boolean(),
  formatVersion: z.number().nullable().optional(),
  snapshotDigest: z.string().optional(),
  source: z.strictObject({ kind: z.literal('git-working-tree') }).optional(),
  project: z.unknown().optional(),
  view: z.string().optional(),
  inputDigest: z.string().optional(),
  manifestDigest: z.string().nullable().optional(),
  diagnosticCount: z.number().optional(),
  errorCount: z.number().optional(),
  warningCount: z.number().optional(),
  acceptedWarningCount: z.number().optional(),
  relevant: z.boolean().optional(),
  counts: z
    .strictObject({
      agents: z.number().optional(),
      context: z.number().optional(),
      decisions: z.number().optional(),
      diagnostics: z.number().optional(),
      errors: z.number().optional(),
      acceptedWarnings: z.number().optional(),
      coverage: z.number().optional(),
      metadata: z.number().optional(),
      mirrors: z.number().optional(),
      runtimes: z.number().optional(),
      unresolved: z.number().optional(),
      warnings: z.number().optional(),
      declarations: z.number().optional(),
      inputPaths: z.number().optional(),
      matchedOwners: z.number().optional(),
      matchedPaths: z.number().optional(),
      matches: z.number().optional(),
    })
    .transform((counts) =>
      Object.fromEntries(
        Object.entries(counts).filter((entry): entry is [string, number] => entry[1] !== undefined),
      ),
    )
    .optional(),
  coverageCounts: z
    .strictObject({
      bindings: z.number().int().nonnegative(),
      exportsPassed: z.number().int().nonnegative(),
      exportsFailed: z.number().int().nonnegative(),
      exportsNotChecked: z.number().int().nonnegative(),
    })
    .optional(),
  page: z.strictObject({
    cursor: z.string().nullable(),
    records: z.array(
      z.union([
        CliDiagnosticRecord,
        CliCoverageRecord,
        CliAgentRecord,
        CliMetadataRecord,
        CliMatchRecord,
      ]),
    ),
  }),
});
export const CliInspectionResult = CliCollectionResult;
export const CliContentResult = z.object({
  asset: z.object({ path: z.string(), totalBytes: z.number().int().nonnegative() }),
  chunk: z.object({
    byteStart: z.number().int().nonnegative(),
    byteEnd: z.number().int().nonnegative(),
    content: z.string(),
  }),
  cursor: z.string().nullable(),
});
export const CliCompositionResult = z.object({
  packages: z.array(z.object({ name: z.string(), version: z.string() })),
  minimumGitVersion: z.string(),
  repositoryFormatVersions: z.array(z.number()),
  supportedNodeRange: z.string(),
});
