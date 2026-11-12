import { deepFreeze } from 'jg-utilities';

import { parseRepositoryPath } from '@moldea.ai/repository';

import type {
  IDecisionParseResult,
  IIndexedTextAsset,
  ITextDocumentInput,
} from '../contracts/index.js';
import {
  extractDecisionSections,
  validateDecisionBody,
  validateDecisionFrontmatter,
} from '../decision-validation/index.js';
import {
  createCoreDiagnosticCollector,
  locateDiagnosticRanges,
} from '../diagnostic-utilities/index.js';
import type { ICoreOperation } from '../exceptions/index.js';
import { parseDecisionIdFromPath } from '../format-validation/index.js';
import { createCoreOperationOptionsSnapshot, type ICoreOptionsSnapshot } from '../options/index.js';
import { createSourceLocator } from '../source-location/index.js';
import { calculateNormalizedTextDigest, normalizeTextDocument } from '../text/index.js';
import { parseStrictYaml, type IYamlNode } from '../yaml/index.js';

// parsed frontmatter retained only inside the repository inspection lifetime
export interface IDecisionDocumentInspectionResult extends IDecisionParseResult {
  readonly yamlRoot: IYamlNode | null;
}

/**
 * Parses and validates one complete decision document without resolving cross-file relationships.
 * @param input The canonical logical path and exact decision text or bytes.
 * @param options The immutable Core limit snapshot.
 * @param operation The owning public or repository-level operation for typed failures.
 * @returns A frozen all-or-nothing decision parse result.
 * @throws
 * - INVALID_REPOSITORY_PATH: The repository path is invalid.
 * - INVALID_ARGUMENT: The Core operation received an invalid argument.
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 */
export const inspectDecisionDocument = async (
  input: ITextDocumentInput,
  options: ICoreOptionsSnapshot,
  operation: Extract<ICoreOperation, 'parse-decision' | 'validate-project'> = 'parse-decision',
): Promise<IDecisionDocumentInspectionResult> => {
  options = createCoreOperationOptionsSnapshot(options);
  const normalized = normalizeTextDocument(input, options.limits, operation);
  const path = parseRepositoryPath(input.path);
  const diagnostics = createCoreDiagnosticCollector(options.limits, operation);
  const decisionId = parseDecisionIdFromPath(path);

  if (decisionId === null) {
    diagnostics.add({ code: 'MOLDEA_DECISION_FILENAME_INVALID', path });
  }

  for (const diagnostic of normalized.diagnostics) {
    diagnostics.merge(diagnostic);
  }

  if (!normalized.valid || normalized.text === null) {
    return deepFreeze({
      decision: null,
      diagnostics: diagnostics.finalize(),
      valid: false,
      yamlRoot: null,
    });
  }

  const context = { decisionId, diagnostics, path };
  const locator = createSourceLocator(normalized.text.value);
  const sections = extractDecisionSections(normalized.text.value, locator, context);
  let metadata: ReturnType<typeof validateDecisionFrontmatter> = null;
  let yamlRoot: IYamlNode | null = null;

  if (sections !== null) {
    validateDecisionBody(sections.body, sections.bodyRange, context);
    const parsed = parseStrictYaml(sections.yaml, path, locator, diagnostics);
    yamlRoot = parsed.value;

    if (parsed.valid && parsed.value !== null) {
      metadata = validateDecisionFrontmatter(parsed.value, context);
    }
  }
  const locatedDiagnostics = locateDiagnosticRanges(
    diagnostics.finalize(),
    new Map(yamlRoot === null ? [] : [[path, yamlRoot]]),
  );

  if (decisionId === null || sections === null || metadata === null || diagnostics.size > 0) {
    return deepFreeze({
      decision: null,
      diagnostics: locatedDiagnostics,
      valid: false,
      yamlRoot,
    });
  }

  const digest = await calculateNormalizedTextDigest(normalized.text);
  const asset: IIndexedTextAsset = {
    content: normalized.text.value,
    digest,
    path,
    scalarLength: normalized.text.scalarLength,
    utf8ByteLength: normalized.text.utf8ByteLength,
  };

  return deepFreeze({
    decision: {
      asset,
      body: sections.body,
      createdAt: metadata.createdAt,
      id: decisionId,
      path,
      status: metadata.status,
      supersedes: metadata.supersedes,
    },
    diagnostics: locatedDiagnostics,
    valid: true,
    yamlRoot,
  });
};

/**
 * Parses a decision without exposing private YAML nodes to public callers.
 * @returns The immutable decision parse result.
 * @throws
 * - INVALID_REPOSITORY_PATH: The repository path is invalid.
 * - INVALID_ARGUMENT: The Core operation received an invalid argument.
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 */
export const parseDecisionDocument = async (
  input: ITextDocumentInput,
  options: ICoreOptionsSnapshot,
  operation: Extract<ICoreOperation, 'parse-decision' | 'validate-project'> = 'parse-decision',
): Promise<IDecisionParseResult> => {
  const inspection = await inspectDecisionDocument(input, options, operation);
  return deepFreeze({
    decision: inspection.decision,
    diagnostics: inspection.diagnostics,
    valid: inspection.valid,
  });
};
