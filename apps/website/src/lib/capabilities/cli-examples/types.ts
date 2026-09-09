import { z } from 'zod';

// schema 4 is a closed envelope; command results validate only the fields consumed below
export const CliEnvelope = z.strictObject({
  cliVersion: z.string(),
  command: z.enum(['validate', 'inspect', 'scope', 'content', 'composition']),
  schemaVersion: z.literal(4),
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

// known metadata and relationship records; additive producer fields are intentionally stripped
export const CliCollectionResult = z.object({
  valid: z.boolean(),
  diagnosticCount: z.number().optional(),
  relevant: z.boolean().optional(),
  counts: z
    .object({
      agents: z.number().optional(),
      context: z.number().optional(),
      decisions: z.number().optional(),
      diagnostics: z.number().optional(),
      evidence: z.number().optional(),
      metadata: z.number().optional(),
      mirrors: z.number().optional(),
      runtimes: z.number().optional(),
      unresolved: z.number().optional(),
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
    records: z.array(
      z.object({
        agentId: z.string().nullable().optional(),
        kind: z.string(),
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
      }),
    ),
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
