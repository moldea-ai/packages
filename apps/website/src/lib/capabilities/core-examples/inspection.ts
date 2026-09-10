import { createCore } from '@moldea.ai/core';
import { parseRepositoryPath } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import type { ICapabilityCase, ICapabilityFact } from '../index.ts';
import { assertCapabilityFacts, captureOperationalRefusal } from '../index.ts';
import { projectFile } from '../index.ts';
import { RUNTIME_EXAMPLES } from '../runtime-examples/index.ts';

import { createCoreEntries, MANIFEST_PATH, PROJECT_PATH } from './constants.ts';

const scopeManifest = `version: 1
context:
  /moldea/project.md:
    bindings: [{ path: /src/returns/policy.ts }]
    affectedBy: [/src/returns/**]
unresolved:
  international-returns:
    category: policy
    effect: warning
    description: International return eligibility is not documented.
    resolution: Record the approved international return policy.
    related: [{ path: /src/returns/international.ts }]
`;

/** Builds a content-bounded operation example without inventing a validation verdict. */
const operationCase = (
  id: string,
  operation: string,
  title: string,
  description: string,
  facts: Record<string, ICapabilityFact>,
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
  result: { kind: 'inspection', facts },
});

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
    ),
  );

  const runtime = RUNTIME_EXAMPLES.find(({ id }) => id === 'openai-loader-disconnected');
  if (runtime === undefined) throw new Error('The Core inspection runtime fixture is missing.');
  const inspectedRepository = createMemoryRepositoryReader(runtime.files);
  const inspectionCore = createCore({ adapters: [runtime.adapter] });
  const preparedInspection = await inspectionCore.createProjectInspection({
    repository: inspectedRepository,
  });
  for (const view of ['metadata', 'diagnostics', 'evidence'] as const) {
    const pages: ICapabilityFact[] = [];
    let cursor: string | undefined;
    let recordCount = 0;
    let totalItems: number;
    let digest: string | null = null;
    do {
      const result = preparedInspection.readPage({
        view,
        maxItems: 2,
        ...(cursor === undefined ? {} : { cursor }),
      });
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
                  evidenceKind: item.evidence.kind,
                  agentId: item.evidence.agentId,
                  references: item.evidence.references.map(({ path, symbol }) => ({
                    path,
                    symbol: symbol ?? null,
                  })),
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
    assertCapabilityFacts(totalItems, view === 'metadata' ? 5 : view === 'diagnostics' ? 1 : 5);
    examples.push(
      operationCase(
        `inspection-${view}`,
        'createProjectInspection',
        `${view === 'metadata' ? 'Assignments and asset metadata' : view === 'diagnostics' ? 'Diagnostics' : 'Runtime evidence'} in bounded pages`,
        'The requested view returns records and a stable inspection digest, without canonical document bodies.',
        { view, totalItems, inspectionDigest: digest, pages },
      ),
    );
  }

  const content = 'Café returns\n';
  const contentByteLength = new TextEncoder().encode(content).byteLength;
  const repository = createMemoryRepositoryReader(
    createCoreEntries('version: 1\n', [
      { path: '/moldea/context/returns.md', type: 'file', content },
    ]),
  );
  const chunks: ICapabilityFact[] = [];
  let offset = 0;
  let reconstructed = '';
  do {
    const page = await core.readCanonicalContentPage({
      repository,
      path: parseRepositoryPath('/moldea/context/returns.md'),
      offset,
      maxBytes: 4,
    });
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
  );
  scopeCase.limitation =
    'Relevance does not prove semantic impact or that an unresolved requirement has been satisfied.';
  scopeCase.files = [
    projectFile({ path: MANIFEST_PATH, type: 'file', content: scopeManifest }),
  ].filter((file) => file !== null);
  examples.push(scopeCase);
  return examples;
};
