import { createCore } from '@moldea.ai/core';
import { parseRepositoryPath } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import type { ICapabilityCase, ICapabilityFact } from '../index.ts';
import {
  assertCapabilityFacts,
  captureOperationalRefusal,
  createRecordedOutput,
} from '../index.ts';
import { projectFile } from '../index.ts';
import { MANAGED_INTEGRATION_ENTRIES } from '../integration-fixture/index.ts';

import { createCoreEntries, MANIFEST_PATH, PROJECT_PATH } from './constants.ts';

const scopeManifest = `version: 1
context:
  /moldea/project.md:
    bindings:
      - path: /src/returns/policy.ts
    affectedBy:
      - /src/returns/**
unresolved:
  international-returns:
    category: policy
    effect: warning
    description: International return eligibility is not documented.
    resolution: Record the approved international return policy.
    related:
      - path: /src/returns/international.ts
`;

/** Builds a content-bounded operation example without inventing a validation verdict. */
const operationCase = (
  id: string,
  operation: string,
  title: string,
  description: string,
  facts: Record<string, ICapabilityFact>,
  responses?: unknown[],
): ICapabilityCase => ({
  id,
  groupId: 'repository-access',
  title,
  description,
  operation,
  packageName: '@moldea.ai/core',
  limitation: 'These are structural facts, not a semantic evaluation.',
  sourcePaths: [
    'projects/core/docs/repository-inspection.md',
    'projects/core/docs/text-and-parsing.md',
  ],
  files: [],
  output: createRecordedOutput(
    responses ?? [facts],
    responses === undefined ? 'execution-facts' : 'response',
  ),
  result: { kind: 'inspection', facts },
});

/** Shows that every diagnostic page keeps complete counts while preserving each severity. */
const createMixedDiagnosticExample = async (): Promise<ICapabilityCase> => {
  const files = createCoreEntries(
    `version: 1
context:
  /moldea/project.md:
    bindings:
      - path: /src/returns.ts
        symbol: canReturn
    affectedBy:
      - /src/future/**
`,
    [{ path: '/src/returns.ts', type: 'file', content: 'export const otherRule = () => true;\n' }],
  );
  const inspection = await createCore().createProjectInspection({
    repository: createMemoryRepositoryReader(files),
  });
  const first = inspection.readPage({ view: 'diagnostics', maxItems: 1 });
  if (first.page.nextCursor === null) throw new Error('A diagnostic continuation is missing.');
  const diagnosticPages = [first];
  let cursor: string | null = first.page.nextCursor;
  while (cursor !== null) {
    const page = inspection.readPage({ view: 'diagnostics', maxItems: 1, cursor });
    assertCapabilityFacts(page.counts, first.counts);
    assertCapabilityFacts(page.inspectionDigest, first.inspectionDigest);
    diagnosticPages.push(page);
    cursor = page.page.nextCursor;
  }
  const pages = diagnosticPages.map((page) => ({
    records: page.page.records.map(({ item }) => {
      if (item.kind !== 'diagnostic') throw new Error('A diagnostic page contains another record.');
      return {
        code: item.diagnostic.code,
        group: item.diagnostic.group,
        severity: item.diagnostic.severity,
      };
    }),
    hasContinuation: page.page.nextCursor !== null,
  }));
  assertCapabilityFacts(
    [first.counts.diagnostics, first.counts.errors, first.counts.warnings],
    [3, 1, 2],
  );
  assertCapabilityFacts(pages, [
    {
      records: [
        { code: 'MOLDEA_IMPACT_PATTERN_UNMATCHED', group: 'references', severity: 'warning' },
      ],
      hasContinuation: true,
    },
    {
      records: [
        { code: 'MOLDEA_INTEGRATION_BLOCK_MISSING', group: 'integration', severity: 'warning' },
      ],
      hasContinuation: true,
    },
    {
      records: [
        { code: 'MOLDEA_REFERENCE_EXPORT_MISSING', group: 'references', severity: 'error' },
      ],
      hasContinuation: false,
    },
  ]);

  const example = operationCase(
    'inspection-mixed-diagnostics',
    'createProjectInspection',
    'Warnings and errors across three pages',
    'Every page retains complete counts. The missing export is an error; the absent integration block and unmatched impact pattern are warnings.',
    {
      counts: {
        diagnostics: first.counts.diagnostics,
        errors: first.counts.errors,
        warnings: first.counts.warnings,
      },
      pages,
    },
    diagnosticPages,
  );
  example.files = files.map((entry) => projectFile(entry)).filter((file) => file !== null);
  return example;
};

/**
 * Exercises normalization, identity, bounded inspection, canonical content, and change relevance.
 * @returns Actual selected facts from the public Core operations.
 */
export const createCoreInspectionExamples = async (): Promise<ICapabilityCase[]> => {
  const core = createCore();
  const examples: ICapabilityCase[] = [];
  const text = '# Return policy\n\nReturns are accepted within 30 days.\n';
  const normalized = core.normalizeText({
    path: parseRepositoryPath(PROJECT_PATH),
    content: `\uFEFF${text.replaceAll('\n', '\r\n')}`,
  });
  assertCapabilityFacts(normalized.text?.value, text);
  assertCapabilityFacts(normalized.diagnostics, []);
  examples.push(
    operationCase(
      'text-normalization',
      'normalizeText',
      'Different line endings, the same text',
      'BOM removal and line-ending normalization produce one canonical representation.',
      {
        valid: normalized.valid,
        normalizedText: normalized.text?.value ?? null,
        utf8ByteLength: normalized.text?.utf8ByteLength ?? null,
        scalarLength: normalized.text?.scalarLength ?? null,
      },
      [normalized],
    ),
  );
  const digestInputs = [text, `\uFEFF${text.replaceAll('\n', '\r\n')}`, text.replace('30', '60')];
  const digests = await Promise.all(
    digestInputs.map((content) =>
      core.calculateContentDigest({ path: parseRepositoryPath(PROJECT_PATH), content }),
    ),
  );
  assertCapabilityFacts(
    digests.map(({ valid }) => valid),
    [true, true, true],
  );
  const [original, normalizedCopy, changed] = digests;
  if (original === undefined || normalizedCopy === undefined || changed === undefined)
    throw new Error('A capability digest fixture is missing.');
  assertCapabilityFacts(original.digest === normalizedCopy.digest, true);
  assertCapabilityFacts(original.digest === changed.digest, false);
  examples.push(
    operationCase(
      'normalized-digests',
      'calculateContentDigest',
      'Different line endings. Same fingerprint.',
      'An editor’s line-ending change preserves the fingerprint. Changing 30 days to 60 does not.',
      {
        originalDigest: original.digest,
        normalizedCopyDigest: normalizedCopy.digest,
        changedDigest: changed.digest,
        inputs: digestInputs,
      },
      digests,
    ),
  );

  const preparedInspection = await core.createProjectInspection({
    repository: createMemoryRepositoryReader([
      ...MANAGED_INTEGRATION_ENTRIES,
      ...createCoreEntries(
        `version: 1
context:
  /moldea/project.md:
    bindings:
      - path: /src/returns.ts
        symbol: canReturn
      - path: /src/returns.ts
        symbol: otherRule
    affectedBy:
      - /src/future/**
`,
        [
          {
            path: '/src/returns.ts',
            type: 'file',
            content: 'export const canReturn = () => true;\nexport * from "./policy.js";\n',
          },
        ],
      ),
    ]),
  });
  for (const view of ['metadata', 'diagnostics', 'coverage'] as const) {
    const pages: ICapabilityFact[] = [];
    const responses: unknown[] = [];
    let cursor: string | undefined;
    let recordCount = 0;
    let totalItems: number;
    let digest: string | null = null;
    do {
      const result = preparedInspection.readPage({
        view,
        maxItems: 1,
        ...(cursor === undefined ? {} : { cursor }),
      });
      responses.push(result);
      const records = result.page.records.map(({ item }): ICapabilityFact =>
        item.kind === 'agent'
          ? {
              kind: item.kind,
              agentId: item.agent.agentId,
              runtimeId: item.agent.runtimeId,
            }
          : item.kind === 'metadata'
            ? {
                kind: item.kind,
                path: item.metadata.path,
                assetKind: item.metadata.kind,
                digest: item.metadata.digest,
                byteLength: item.metadata.byteLength,
              }
            : item.kind === 'diagnostic'
              ? { kind: item.kind, code: item.diagnostic.code, path: item.diagnostic.path }
              : {
                  kind: item.kind,
                  relationship: item.coverage.relationship,
                  path: item.coverage.path,
                  symbol: item.coverage.symbol,
                  fileCheck: item.coverage.fileCheck,
                  exportCheck: item.coverage.exportCheck,
                },
      );
      if (digest !== null) assertCapabilityFacts(result.inspectionDigest, digest);
      digest = result.inspectionDigest;
      recordCount += records.length;
      totalItems = result.page.totalItems;
      if (recordCount > totalItems || (!result.page.isComplete && records.length === 0))
        throw new Error('A capability inspection page did not make bounded progress.');
      pages.push({
        records,
        isComplete: result.page.isComplete,
        hasContinuation: result.page.nextCursor !== null,
      });
      cursor = result.page.nextCursor ?? undefined;
    } while (cursor !== undefined);
    assertCapabilityFacts(recordCount, totalItems);
    assertCapabilityFacts(totalItems, view === 'diagnostics' ? 1 : 2);
    examples.push(
      operationCase(
        `inspection-${view}`,
        'createProjectInspection',
        `${view === 'metadata' ? 'Assignments and asset metadata' : view === 'diagnostics' ? 'Diagnostics' : 'Binding coverage'} in bounded pages`,
        'The requested view returns records and a stable inspection digest, without canonical document bodies.',
        { view, totalItems, inspectionDigest: digest, pages },
        responses,
      ),
    );
  }
  examples.push(await createMixedDiagnosticExample());

  const content = 'Café returns\n';
  const contentByteLength = new TextEncoder().encode(content).byteLength;
  const repository = createMemoryRepositoryReader(
    createCoreEntries('version: 1\n', [
      { path: '/moldea/context/returns.md', type: 'file', content },
    ]),
  );
  const chunks: ICapabilityFact[] = [];
  const contentResponses: unknown[] = [];
  let offset = 0;
  let reconstructed = '';
  do {
    const page = await core.readCanonicalContentPage({
      repository,
      path: parseRepositoryPath('/moldea/context/returns.md'),
      offset,
      maxBytes: 4,
    });
    contentResponses.push(page);
    reconstructed += page.content;
    assertCapabilityFacts(
      [page.totalBytes, page.byteStart, page.byteEnd],
      [contentByteLength, offset, new TextEncoder().encode(reconstructed).byteLength],
    );
    assertCapabilityFacts(
      page.isComplete,
      page.nextOffset === null && page.byteEnd === contentByteLength,
    );
    chunks.push({
      byteStart: page.byteStart,
      byteEnd: page.byteEnd,
      content: page.content,
      isComplete: page.isComplete,
      nextOffset: page.nextOffset,
      totalBytes: page.totalBytes,
    });
    if (page.nextOffset === null) break;
    if (page.nextOffset <= offset)
      throw new Error('A capability content page did not make progress.');
    offset = page.nextOffset;
  } while (offset < contentByteLength);
  assertCapabilityFacts(reconstructed, content);
  examples.push(
    operationCase(
      'canonical-content-pages',
      'readCanonicalContentPage',
      'Read text without splitting a character',
      'An explicit content request returns Unicode-safe chunks of one canonical document.',
      { chunks },
      contentResponses,
    ),
  );
  examples.push(
    operationCase(
      'canonical-content-refusal',
      'readCanonicalContentPage',
      'Ordinary source code is not canonical content',
      'The content operation refuses a non-canonical selection.',
      await captureOperationalRefusal(
        () =>
          core.readCanonicalContentPage({
            repository,
            path: parseRepositoryPath('/src/returns.ts'),
            offset: 0,
            maxBytes: 4,
          }),
        'INVALID_ARGUMENT',
      ),
    ),
  );
  examples.push(
    operationCase(
      'core-resource-refusal',
      'readCanonicalContentPage',
      'A read stops at its resource boundary',
      'Exceeding the configured file budget is an operational refusal, not a content diagnostic.',
      await captureOperationalRefusal(
        () =>
          createCore({ limits: { maxFileBytes: 4 } }).readCanonicalContentPage({
            repository,
            path: parseRepositoryPath('/moldea/context/returns.md'),
            offset: 0,
            maxBytes: 4,
          }),
        'RESOURCE_LIMIT_EXCEEDED',
      ),
    ),
  );

  const scope = await core.matchManifestScope({
    manifest: { path: parseRepositoryPath(MANIFEST_PATH), content: scopeManifest },
    paths: ['/src/returns/policy.ts', '/src/returns/international.ts', '/assets/logo.svg'],
  });
  assertCapabilityFacts(scope.valid, true);
  assertCapabilityFacts(scope.diagnostics, []);
  assertCapabilityFacts(
    scope.matches.map(({ inputPath, owner, field }) => ({ inputPath, owner: owner.kind, field })),
    [
      { inputPath: '/src/returns/international.ts', owner: 'context', field: 'affectedBy' },
      { inputPath: '/src/returns/policy.ts', owner: 'context', field: 'affectedBy' },
      { inputPath: '/src/returns/policy.ts', owner: 'context', field: 'bindings' },
      { inputPath: '/src/returns/international.ts', owner: 'unresolved', field: 'related' },
    ],
  );
  const scopeCase = operationCase(
    'manifest-change-relevance',
    'matchManifestScope',
    'Find the knowledge connected to a change',
    'A changed code file leads back to the knowledge linked to it.',
    {
      valid: scope.valid,
      relevant: scope.relevant,
      counts: { ...scope.counts },
      matches: scope.matches.map(({ inputPath, owner, field, pointer, declaration }) => ({
        inputPath,
        owner: { ...owner },
        field,
        pointer,
        declaration: { ...declaration },
      })),
    },
    [scope],
  );
  scopeCase.limitation =
    'Relevance does not prove semantic impact or that an unresolved requirement has been satisfied.';
  scopeCase.files = [
    projectFile({ path: MANIFEST_PATH, type: 'file', content: scopeManifest }),
  ].filter((file) => file !== null);
  examples.push(scopeCase);
  return examples;
};
