import { z } from 'zod';

// schema 5 is a closed envelope; command results validate only the fields consumed below
export const CliEnvelope = z.strictObject({
  cliVersion: z.string(),
  command: z.enum(['validate', 'inspect', 'scope', 'content', 'composition']),
  schemaVersion: z.literal(5),
  status: z.enum(['valid', 'invalid', 'error']),
  error: z
    .object({
      source: z.string(),
      code: z.string(),
      message: z.string(),
      path: z.string().nullable(),
      retryable: z.boolean(),
    })
    .nullable(),
  result: z.unknown(),
});
export type ICliEnvelope = z.infer<typeof CliEnvelope>;

const CliUnverifiedRelationship = z.enum([
  'runtime-agent',
  'instruction-loader',
  'agent-input-schema',
  'agent-output-schema',
  'tool-implementation',
  'tool-registration',
  'tool-input-schema',
  'tool-output-schema',
  'skill-implementation',
  'skill-registration',
  'handoff-registration',
  'routing-description',
  'variable-provider',
]);
const CliWarningDetails = z.union([
  z.strictObject({
    relationship: CliUnverifiedRelationship,
    reason: z.enum(['unsupported-source-pattern', 'dynamic-source-pattern']),
  }),
  z.strictObject({
    relationship: CliUnverifiedRelationship,
    reason: z.literal('version-dependent-behavior'),
    packageName: z.string(),
    declaredRange: z.string().nullable(),
    boundaryVersion: z.string(),
  }),
]);
const CliDiagnosticFields = {
  code: z.string(),
  entity: z
    .strictObject({
      agentId: z.string().optional(),
      adapterId: z.string().optional(),
      capabilityId: z.string().optional(),
      capabilityKind: z.enum(['tool', 'skill']).optional(),
      decisionId: z.string().optional(),
      variableId: z.string().optional(),
    })
    .nullable(),
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
    details: CliWarningDetails,
  }),
]);
const CliOtherRecord = z.object({
  agentId: z.string().nullable().optional(),
  kind: z.enum(['agent', 'evidence', 'metadata', 'match']),
  path: z.string().optional(),
  code: z.string().optional(),
  pointer: z.string().nullable().optional(),
  metadataKind: z.string().optional(),
  runtimeId: z.string().optional(),
  match: z
    .object({
      inputPath: z.string(),
      field: z.string(),
      pointer: z.string(),
      owner: z.object({ kind: z.string(), id: z.string(), agentId: z.string().nullable() }),
    })
    .optional(),
});

// known metadata and relationship records; additive producer fields are intentionally stripped
export const CliCollectionResult = z.object({
  valid: z.boolean(),
  diagnosticCount: z.number().optional(),
  errorCount: z.number().optional(),
  warningCount: z.number().optional(),
  relevant: z.boolean().optional(),
  counts: z
    .object({
      agents: z.number().optional(),
      context: z.number().optional(),
      decisions: z.number().optional(),
      diagnostics: z.number().optional(),
      errors: z.number().optional(),
      evidence: z.number().optional(),
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
  page: z.object({
    cursor: z.string().nullable(),
    records: z.array(z.union([CliDiagnosticRecord, CliOtherRecord])),
  }),
});
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
  adapters: z.array(z.object({ id: z.string(), repositoryFormatVersions: z.array(z.number()) })),
  packages: z.array(z.object({ name: z.string(), version: z.string() })),
  minimumGitVersion: z.string(),
  repositoryFormatVersions: z.array(z.number()),
  supportedNodeRange: z.string(),
});
