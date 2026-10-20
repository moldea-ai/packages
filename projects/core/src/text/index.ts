import { countUtf8Bytes, deepFreeze, isObjectValid } from 'jg-utilities';

import { parseRepositoryPath, type IRepositoryPath } from '@moldea.ai/repository';

import type {
  IContentDigest,
  IContentDigestResult,
  ICoreResourceLimits,
  INormalizedText,
  ITextDocumentInput,
  ITextNormalizationResult,
} from '../contracts/index.js';
import {
  createCoreDiagnosticCollector,
  type ICoreDiagnosticCollector,
} from '../diagnostic-utilities/index.js';
import type { ICoreDiagnostic } from '../diagnostics/index.js';
import { CoreOperationException, type ICoreOperation } from '../exceptions/index.js';
import { countUnicodeScalars } from '../format-validation/index.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/**
 * Collects every normalized NUL location or rejects when the diagnostic budget is exhausted.
 * @param value The normalized scalar text to inspect.
 * @param path The logical document path attached to each diagnostic.
 * @param diagnostics The operation collector receiving every NUL diagnostic.
 * @throws
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 */
const collectNulDiagnostics = (
  value: string,
  path: IRepositoryPath,
  diagnostics: ICoreDiagnosticCollector,
): void => {
  let column = 1;
  let line = 1;
  let offset = 0;

  for (const scalar of value) {
    if (scalar === '\0') {
      diagnostics.add({
        code: 'MOLDEA_TEXT_NUL_FORBIDDEN',
        path,
        range: {
          end: { column: column + 1, line, offset: offset + 1 },
          start: { column, line, offset },
        },
      });
    }

    if (scalar === '\n') {
      column = 1;
      line += 1;
    } else {
      column += 1;
    }

    offset += 1;
  }
};

const invalidArgument = (operation: ICoreOperation): never => {
  throw new CoreOperationException({
    code: 'INVALID_ARGUMENT',
    operation,
  });
};

const enforceFileLimit = (
  byteLength: number,
  limits: ICoreResourceLimits,
  operation: ICoreOperation,
  limit: 'maxFileBytes' | 'maxManifestBytes',
): void => {
  if (byteLength <= limits[limit]) {
    return;
  }

  throw new CoreOperationException({
    code: 'RESOURCE_LIMIT_EXCEEDED',
    limit,
    limitMaximum: limits[limit],
    nextAction: 'reduce-input-or-increase-limit',
    observedUsage: byteLength,
    operation,
  });
};

const invalidResult = (diagnostics: readonly ICoreDiagnostic[]): ITextNormalizationResult => {
  return deepFreeze({
    diagnostics: [...diagnostics],
    text: null,
    valid: false,
  });
};

/**
 * Validates one public text input, enforces its source-byte budget, and decodes strict UTF-8.
 * @param input The untrusted public text-document input.
 * @param limits The immutable Core resource limits.
 * @param operation The public operation requesting the input.
 * @param limit The source-byte limit applied by the operation.
 * @param diagnostics The operation collector receiving text diagnostics.
 * @returns Decoded text or a frozen structural failure result.
 * @throws
 * - INVALID_REPOSITORY_PATH: The repository path is invalid.
 * - INVALID_ARGUMENT: The Core operation received an invalid argument.
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 */
const readInput = (
  input: ITextDocumentInput,
  limits: ICoreResourceLimits,
  operation: ICoreOperation,
  limit: 'maxFileBytes' | 'maxManifestBytes',
  diagnostics: ICoreDiagnosticCollector,
): { readonly path: IRepositoryPath; readonly value: string } | ITextNormalizationResult => {
  if (!isObjectValid(input, true)) {
    return invalidArgument(operation);
  }

  const pathCandidate = input['path'];
  const content = input['content'];

  if (
    typeof pathCandidate !== 'string' ||
    (typeof content !== 'string' && !(content instanceof Uint8Array))
  ) {
    return invalidArgument(operation);
  }

  const path = parseRepositoryPath(pathCandidate);

  if (typeof content === 'string') {
    enforceFileLimit(countUtf8Bytes(content, limits[limit]), limits, operation, limit);

    if (!content.isWellFormed()) {
      diagnostics.add({ code: 'MOLDEA_TEXT_INVALID_UNICODE', path });
      return invalidResult(diagnostics.finalize());
    }

    return { path, value: content };
  }

  enforceFileLimit(content.byteLength, limits, operation, limit);
  const bytes = new Uint8Array(content);

  try {
    return { path, value: decoder.decode(bytes) };
  } catch {
    diagnostics.add({ code: 'MOLDEA_TEXT_INVALID_UTF8', path });
    return invalidResult(diagnostics.finalize());
  }
};

/**
 * Validates and normalizes one text document under an operation-specific resource budget.
 * @param input The logical path and decoded string or exact source bytes.
 * @param limits The immutable Core resource limits.
 * @param operation The public Core operation requesting normalization.
 * @param limit The source-byte limit applied by the operation.
 * @returns A frozen normalized result or structural text diagnostics.
 * @throws
 * - INVALID_REPOSITORY_PATH: The repository path is invalid.
 * - INVALID_ARGUMENT: The Core operation received an invalid argument.
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 */
export const normalizeTextDocument = (
  input: ITextDocumentInput,
  limits: ICoreResourceLimits,
  operation: ICoreOperation,
  limit: 'maxFileBytes' | 'maxManifestBytes' = 'maxFileBytes',
): ITextNormalizationResult => {
  const diagnostics = createCoreDiagnosticCollector(limits, operation);
  const decoded = readInput(input, limits, operation, limit, diagnostics);

  if ('valid' in decoded) {
    return decoded;
  }

  const withoutLeadingBom = decoded.value.startsWith('\ufeff')
    ? decoded.value.slice(1)
    : decoded.value;
  const value = withoutLeadingBom.replace(/\r\n?/gu, '\n');
  collectNulDiagnostics(value, decoded.path, diagnostics);

  if (diagnostics.size > 0) {
    return invalidResult(diagnostics.finalize());
  }

  const text: INormalizedText = deepFreeze({
    scalarLength: countUnicodeScalars(value),
    utf8ByteLength: countUtf8Bytes(value),
    value,
  });

  return deepFreeze({
    diagnostics: [],
    text,
    valid: true,
  });
};

const toLowercaseHex = (bytes: Uint8Array): string => {
  let value = '';

  for (const byte of bytes) {
    value += byte.toString(16).padStart(2, '0');
  }

  return value;
};

/**
 * Calculates the canonical digest for already-normalized text.
 * @param text The validated normalized text to encode and hash.
 * @returns A promise resolving to the canonical lowercase SHA-256 digest.
 */
export const calculateNormalizedTextDigest = async (
  text: INormalizedText,
): Promise<IContentDigest> => {
  const bytes = encoder.encode(text.value);
  const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));

  return `sha256:${toLowercaseHex(hash)}` as IContentDigest;
};

/**
 * Calculates the normalized SHA-256 digest for one text document.
 * @param input The logical path and decoded string or exact source bytes.
 * @param limits The immutable Core resource limits.
 * @returns A promise resolving to a frozen digest result or structural text diagnostics.
 * @throws
 * - INVALID_REPOSITORY_PATH: The repository path is invalid.
 * - INVALID_ARGUMENT: The Core operation received an invalid argument.
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 */
export const calculateContentDigest = async (
  input: ITextDocumentInput,
  limits: ICoreResourceLimits,
): Promise<IContentDigestResult> => {
  const normalized = normalizeTextDocument(input, limits, 'calculate-content-digest');

  if (!normalized.valid || normalized.text === null) {
    return deepFreeze({
      diagnostics: normalized.diagnostics,
      digest: null,
      text: null,
      valid: false,
    });
  }

  const digest = await calculateNormalizedTextDigest(normalized.text);

  return deepFreeze({
    diagnostics: [],
    digest,
    text: normalized.text,
    valid: true,
  });
};
