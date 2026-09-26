import {
  RepositoryPathException,
  RepositorySourceException,
  isRepositoryPath,
  parseRepositoryPath,
  type IRepositoryEntry,
  type IRepositoryPath,
} from '@moldea.ai/repository';

import type {
  IRuntimeAdapterEvidence,
  IRuntimeAdapterEvidenceKind,
  IRuntimeAdapterRepository,
} from '../adapter/index.js';
import type {
  ICoreResourceLimits,
  IIndexedAgent,
  IMoldeaProjectIndex,
} from '../contracts/index.js';
import {
  normalizeDiagnosticDetails,
  normalizeDiagnosticEntity,
  normalizeDiagnostics,
  registerCoreDiagnosticCandidates,
  serializeDiagnosticDetails,
} from '../diagnostic-utilities/index.js';
import type {
  IAdapterDiagnostic,
  IAdapterWarningDiagnostic,
  IDiagnosticEntity,
  ISourcePosition,
  ISourceRange,
  IUnverifiedRelationship,
} from '../diagnostics/index.js';
import { CoreOperationException } from '../exceptions/index.js';
import {
  compareExactStrings,
  isCanonicalMoldeaPath,
  isNonEmptySingleLine,
  isRepositorySymbol,
  isUnicodeScalarText,
  hasSurroundingWhitespace,
  sortRepositoryReferences,
} from '../format-validation/index.js';
import type { IRepositoryReference } from '../format/index.js';
import { createNullPrototypeRecord, freezeRecursively } from '../immutable/index.js';

// closed adapter output fields, evidence kinds, and scalar patterns
const EVIDENCE_KINDS = new Set<IRuntimeAdapterEvidenceKind>([
  'runtime-package',
  'language',
  'agent-definition',
  'instruction-loader',
  'schema',
  'tool-registration',
  'skill-registration',
  'handoff-registration',
  'variable-provider',
  'runtime-pattern',
]);
const DIAGNOSTIC_ENTITY_KEYS = new Set<keyof IDiagnosticEntity>([
  'agentId',
  'capabilityKind',
  'capabilityId',
  'decisionId',
  'variableId',
  'adapterId',
]);
const POSITION_KEYS = new Set(['line', 'column', 'offset']);
const RANGE_KEYS = new Set(['start', 'end']);
const REFERENCE_KEYS = new Set(['path', 'symbol']);
const EVIDENCE_KEYS = new Set([
  'source',
  'kind',
  'agentId',
  'capabilityKind',
  'capabilityId',
  'runtimeName',
  'references',
  'details',
]);
const DIAGNOSTIC_KEYS = new Set([
  'source',
  'severity',
  'code',
  'message',
  'path',
  'pointer',
  'range',
  'entity',
  'details',
]);
const ADAPTER_RESULT_KEYS = new Set(['evidence', 'diagnostics']);
const ADAPTER_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/u;
const UNVERIFIED_MESSAGE = 'The declared runtime relationship could not be verified.';
const UNVERIFIED_RELATIONSHIPS = new Set<IUnverifiedRelationship>([
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
const SIMPLE_WARNING_KEYS = new Set(['relationship', 'reason']);
const VERSION_WARNING_KEYS = new Set([
  'relationship',
  'reason',
  'packageName',
  'declaredRange',
  'boundaryVersion',
]);
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/u;
const BOUNDARY_VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const VERSION_TOKEN =
  '(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?';
const RANGE_COMPARATOR_PATTERN = new RegExp(`^(?:<=|>=|<|>|=)?${VERSION_TOKEN}$`, 'u');

// normalized output retained after one adapter result passes Core validation
export interface IValidatedRuntimeAdapterResult {
  readonly evidence: readonly IRuntimeAdapterEvidence[];
  readonly diagnostics: readonly IAdapterDiagnostic[];
}

// mutable raw output counters shared by every adapter in one inspection
export interface IRuntimeAdapterOutputCounts {
  diagnostics: number;
  evidence: number;
}

interface IAdapterValidationContext {
  readonly adapterId: string;
  readonly agents: readonly IIndexedAgent[];
  readonly project: IMoldeaProjectIndex;
  readonly repository: IRuntimeAdapterRepository;
  readonly limits: ICoreResourceLimits;
  readonly signal?: AbortSignal;
}

interface IAdapterValidationState extends IAdapterValidationContext {
  readonly agentsById: ReadonlyMap<string, IIndexedAgent>;
  readonly decisionIds: ReadonlySet<string>;
}

const isRecord = (candidate: unknown): candidate is Readonly<Record<string, unknown>> => {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate);
};

const invalidAdapterResult = (adapterId: string): never => {
  throw new CoreOperationException({
    adapterId,
    cause: new TypeError('The runtime adapter result is invalid.'),
    code: 'ADAPTER_EXECUTION_FAILED',
    operation: 'validate-adapter',
  });
};

const registerRawOutput = (
  outputCounts: IRuntimeAdapterOutputCounts,
  key: keyof IRuntimeAdapterOutputCounts,
  amount: number,
  context: IAdapterValidationContext,
): void => {
  const limit = key === 'diagnostics' ? 'maxDiagnostics' : 'maxEvidence';

  if (key === 'diagnostics') {
    outputCounts.diagnostics = registerCoreDiagnosticCandidates(
      context.limits,
      amount,
      'validate-adapter',
      outputCounts.diagnostics,
      context.adapterId,
    );
    return;
  }

  if (amount > context.limits[limit] - outputCounts[key]) {
    throw new CoreOperationException({
      adapterId: context.adapterId,
      code: 'RESOURCE_LIMIT_EXCEEDED',
      limit,
      limitMaximum: context.limits[limit],
      nextAction: 'reduce-input-or-increase-limit',
      observedUsage: outputCounts[key] + amount,
      operation: 'validate-adapter',
    });
  }

  outputCounts[key] += amount;
};

const hasOnlyKeys = (
  candidate: Readonly<Record<string, unknown>>,
  keys: ReadonlySet<string>,
): boolean => {
  return Reflect.ownKeys(candidate).every((key) => {
    if (typeof key !== 'string' || !keys.has(key)) {
      return false;
    }

    const descriptor = Object.getOwnPropertyDescriptor(candidate, key);

    return descriptor !== undefined && descriptor.enumerable && 'value' in descriptor;
  });
};

const isSafeString = (candidate: unknown): candidate is string => {
  return (
    typeof candidate === 'string' && isUnicodeScalarText(candidate) && !candidate.includes('\0')
  );
};

const normalizeDetails = (candidate: unknown, adapterId: string) => {
  if (!isRecord(candidate)) {
    return invalidAdapterResult(adapterId);
  }

  const entries: [string, string | number | boolean | null][] = [];

  for (const key of Reflect.ownKeys(candidate)) {
    if (typeof key !== 'string' || !isUnicodeScalarText(key) || key.includes('\0')) {
      return invalidAdapterResult(adapterId);
    }

    const descriptor = Object.getOwnPropertyDescriptor(candidate, key);

    if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
      return invalidAdapterResult(adapterId);
    }

    const detail = descriptor.value as unknown;

    if (
      detail !== null &&
      typeof detail !== 'boolean' &&
      !(typeof detail === 'string' && isUnicodeScalarText(detail) && !detail.includes('\0')) &&
      !(typeof detail === 'number' && Number.isFinite(detail))
    ) {
      return invalidAdapterResult(adapterId);
    }

    entries.push([key, typeof detail === 'number' && Object.is(detail, -0) ? 0 : detail]);
  }

  return normalizeDiagnosticDetails(createNullPrototypeRecord(entries));
};

const normalizePosition = (candidate: unknown, adapterId: string): ISourcePosition => {
  if (
    !isRecord(candidate) ||
    !hasOnlyKeys(candidate, POSITION_KEYS) ||
    !Number.isSafeInteger(candidate['line']) ||
    !Number.isSafeInteger(candidate['column']) ||
    !Number.isSafeInteger(candidate['offset']) ||
    (candidate['line'] as number) < 1 ||
    (candidate['column'] as number) < 1 ||
    (candidate['offset'] as number) < 0
  ) {
    return invalidAdapterResult(adapterId);
  }

  return freezeRecursively({
    column: candidate['column'] as number,
    line: candidate['line'] as number,
    offset: candidate['offset'] as number,
  });
};

const normalizeRange = (candidate: unknown, adapterId: string): ISourceRange | null => {
  if (candidate === null) {
    return null;
  }

  if (!isRecord(candidate) || !hasOnlyKeys(candidate, RANGE_KEYS)) {
    return invalidAdapterResult(adapterId);
  }

  const start = normalizePosition(candidate['start'], adapterId);
  const end = normalizePosition(candidate['end'], adapterId);
  const hasOrderedLines =
    end.line > start.line || (end.line === start.line && end.column >= start.column);

  if (!hasOrderedLines || end.offset < start.offset) {
    return invalidAdapterResult(adapterId);
  }

  return freezeRecursively({ end, start });
};

const isJsonPointer = (candidate: string): boolean => {
  return (
    isUnicodeScalarText(candidate) &&
    !candidate.includes('\0') &&
    (candidate === '' || (candidate.startsWith('/') && !/~(?![01])/u.test(candidate)))
  );
};

const readCapability = (
  agent: IIndexedAgent,
  capabilityKind: 'tool' | 'skill',
  capabilityId: string,
): unknown => {
  const capabilities =
    capabilityKind === 'tool' ? agent.declaration.tools : agent.declaration.skills;

  return capabilities !== undefined && Object.hasOwn(capabilities, capabilityId)
    ? capabilities[capabilityId]
    : undefined;
};

const normalizeEntity = (
  candidate: unknown,
  context: IAdapterValidationState,
): IDiagnosticEntity | null => {
  if (candidate === null) {
    return null;
  }

  if (!isRecord(candidate) || !hasOnlyKeys(candidate, DIAGNOSTIC_ENTITY_KEYS)) {
    return invalidAdapterResult(context.adapterId);
  }

  const entity: Record<string, string> = {};

  for (const key of DIAGNOSTIC_ENTITY_KEYS) {
    const candidateValue = candidate[key];

    if (candidateValue === undefined) {
      continue;
    }

    if (!isSafeString(candidateValue) || candidateValue.length === 0) {
      return invalidAdapterResult(context.adapterId);
    }

    entity[key] = candidateValue;
  }

  const agentId = entity['agentId'];
  const agent = agentId === undefined ? undefined : context.agentsById.get(agentId);

  if (agentId !== undefined && agent === undefined) {
    return invalidAdapterResult(context.adapterId);
  }

  if (entity['adapterId'] !== undefined && entity['adapterId'] !== context.adapterId) {
    return invalidAdapterResult(context.adapterId);
  }

  const capabilityKind = entity['capabilityKind'];
  const capabilityId = entity['capabilityId'];

  if (
    (capabilityKind === undefined) !== (capabilityId === undefined) ||
    (capabilityKind !== undefined && capabilityKind !== 'tool' && capabilityKind !== 'skill') ||
    (capabilityKind !== undefined &&
      capabilityId !== undefined &&
      (agent === undefined || readCapability(agent, capabilityKind, capabilityId) === undefined))
  ) {
    return invalidAdapterResult(context.adapterId);
  }

  const variableId = entity['variableId'];

  if (
    variableId !== undefined &&
    (agent === undefined ||
      agent.declaration.variables === undefined ||
      !Object.hasOwn(agent.declaration.variables, variableId))
  ) {
    return invalidAdapterResult(context.adapterId);
  }

  const decisionId = entity['decisionId'];

  if (decisionId !== undefined && !context.decisionIds.has(decisionId)) {
    return invalidAdapterResult(context.adapterId);
  }

  return normalizeDiagnosticEntity(entity);
};

/** Checks only the safe wire grammar; adapters own SemVer meaning and normalization. */
const isNormalizedRangeWire = (candidate: string): boolean => {
  if (candidate === '*') {
    return true;
  }

  return candidate.split(' || ').every((set) => {
    const comparators = set.split(' ');

    return (
      comparators.length > 0 && comparators.every((part) => RANGE_COMPARATOR_PATTERN.test(part))
    );
  });
};

const isValidWarningSubject = (
  relationship: IUnverifiedRelationship,
  entity: IDiagnosticEntity | null,
  context: IAdapterValidationState,
): boolean => {
  if (entity?.agentId === undefined || entity.decisionId !== undefined) {
    return false;
  }

  const agent = context.agentsById.get(entity.agentId);

  if (agent === undefined) {
    return false;
  }

  if (relationship === 'variable-provider') {
    return (
      entity.capabilityKind === undefined &&
      entity.capabilityId === undefined &&
      entity.variableId !== undefined &&
      agent.declaration.bindings?.variableProviders?.[entity.variableId] !== undefined
    );
  }

  if (entity.variableId !== undefined) {
    return false;
  }

  if (relationship.startsWith('tool-')) {
    if (entity.capabilityKind !== 'tool' || entity.capabilityId === undefined) {
      return false;
    }

    const tool = agent.declaration.tools?.[entity.capabilityId];

    return (
      tool !== undefined &&
      (relationship !== 'tool-input-schema' || tool.inputSchema !== undefined) &&
      (relationship !== 'tool-output-schema' || tool.outputSchema !== undefined)
    );
  }

  if (relationship.startsWith('skill-')) {
    return (
      entity.capabilityKind === 'skill' &&
      entity.capabilityId !== undefined &&
      agent.declaration.skills?.[entity.capabilityId] !== undefined
    );
  }

  if (entity.capabilityKind !== undefined || entity.capabilityId !== undefined) {
    return false;
  }

  if (relationship === 'runtime-agent') {
    return agent.declaration.bindings?.runtimeAgent !== undefined;
  }

  if (relationship === 'instruction-loader') {
    return agent.declaration.bindings?.instructionLoader !== undefined;
  }

  if (relationship === 'agent-input-schema') {
    return agent.declaration.bindings?.inputSchema !== undefined;
  }

  if (relationship === 'agent-output-schema') {
    return agent.declaration.bindings?.outputSchema !== undefined;
  }

  return relationship === 'handoff-registration' || relationship === 'routing-description';
};

const normalizeWarningDetails = (
  candidate: unknown,
  entity: IDiagnosticEntity | null,
  context: IAdapterValidationState,
): IAdapterWarningDiagnostic['details'] => {
  const details = normalizeDetails(candidate, context.adapterId);
  const relationship = details['relationship'];
  const reason = details['reason'];

  if (
    typeof relationship !== 'string' ||
    !UNVERIFIED_RELATIONSHIPS.has(relationship as IUnverifiedRelationship) ||
    !isValidWarningSubject(relationship as IUnverifiedRelationship, entity, context)
  ) {
    return invalidAdapterResult(context.adapterId);
  }

  if (reason === 'unsupported-source-pattern' || reason === 'dynamic-source-pattern') {
    if (!hasOnlyKeys(details, SIMPLE_WARNING_KEYS)) {
      return invalidAdapterResult(context.adapterId);
    }

    return freezeRecursively({ relationship: relationship as IUnverifiedRelationship, reason });
  }

  if (reason !== 'version-dependent-behavior' || !hasOnlyKeys(details, VERSION_WARNING_KEYS)) {
    return invalidAdapterResult(context.adapterId);
  }

  const packageName = details['packageName'];
  const declaredRange = details['declaredRange'];
  const boundaryVersion = details['boundaryVersion'];

  if (
    typeof packageName !== 'string' ||
    !PACKAGE_NAME_PATTERN.test(packageName) ||
    (declaredRange !== null &&
      (typeof declaredRange !== 'string' || !isNormalizedRangeWire(declaredRange))) ||
    typeof boundaryVersion !== 'string' ||
    !BOUNDARY_VERSION_PATTERN.test(boundaryVersion)
  ) {
    return invalidAdapterResult(context.adapterId);
  }

  return freezeRecursively({
    boundaryVersion,
    declaredRange,
    packageName,
    reason,
    relationship: relationship as IUnverifiedRelationship,
  });
};

const normalizeReference = (candidate: unknown, adapterId: string): IRepositoryReference => {
  if (!isRecord(candidate) || !hasOnlyKeys(candidate, REFERENCE_KEYS)) {
    return invalidAdapterResult(adapterId);
  }

  const pathCandidate = candidate['path'];
  const symbolCandidate = candidate['symbol'];

  if (typeof pathCandidate !== 'string' || !isRepositoryPath(pathCandidate)) {
    return invalidAdapterResult(adapterId);
  }

  const path = parseRepositoryPath(pathCandidate);

  if (
    symbolCandidate !== undefined &&
    (typeof symbolCandidate !== 'string' ||
      !isUnicodeScalarText(symbolCandidate) ||
      !isRepositorySymbol(symbolCandidate) ||
      isCanonicalMoldeaPath(path))
  ) {
    return invalidAdapterResult(adapterId);
  }

  return freezeRecursively({
    path,
    ...(symbolCandidate === undefined ? {} : { symbol: symbolCandidate }),
  });
};

const normalizeReferences = (
  candidate: unknown,
  adapterId: string,
): readonly IRepositoryReference[] => {
  if (!Array.isArray(candidate) || candidate.length === 0) {
    return invalidAdapterResult(adapterId);
  }

  const references = candidate.map((reference) => normalizeReference(reference, adapterId));
  const referenceKeys = new Set<string>();

  for (const reference of references) {
    const key = JSON.stringify([reference.path, reference.symbol ?? null]);

    if (referenceKeys.has(key)) {
      return invalidAdapterResult(adapterId);
    }

    referenceKeys.add(key);
  }

  return freezeRecursively(sortRepositoryReferences(references));
};

const normalizeEvidence = (
  candidate: unknown,
  context: IAdapterValidationState,
): IRuntimeAdapterEvidence => {
  if (!isRecord(candidate) || !hasOnlyKeys(candidate, EVIDENCE_KEYS)) {
    return invalidAdapterResult(context.adapterId);
  }

  const source = candidate['source'];
  const kind = candidate['kind'];
  const agentId = candidate['agentId'];
  const capabilityKind = candidate['capabilityKind'];
  const capabilityId = candidate['capabilityId'];
  const runtimeName = candidate['runtimeName'];

  if (
    source !== context.adapterId ||
    typeof kind !== 'string' ||
    !EVIDENCE_KINDS.has(kind as IRuntimeAdapterEvidenceKind) ||
    (agentId !== null && !isSafeString(agentId)) ||
    (capabilityKind !== null && capabilityKind !== 'tool' && capabilityKind !== 'skill') ||
    (capabilityId !== null && !isSafeString(capabilityId)) ||
    (runtimeName !== null &&
      (!isSafeString(runtimeName) ||
        !isNonEmptySingleLine(runtimeName) ||
        hasSurroundingWhitespace(runtimeName)))
  ) {
    return invalidAdapterResult(context.adapterId);
  }

  const scopedAgent = agentId === null ? undefined : context.agentsById.get(agentId);

  if (
    (agentId !== null && scopedAgent === undefined) ||
    (capabilityKind === null) !== (capabilityId === null) ||
    (capabilityKind !== null &&
      capabilityId !== null &&
      (scopedAgent === undefined ||
        readCapability(scopedAgent, capabilityKind, capabilityId) === undefined))
  ) {
    return invalidAdapterResult(context.adapterId);
  }

  return freezeRecursively({
    agentId,
    capabilityId,
    capabilityKind,
    details: normalizeDetails(candidate['details'], context.adapterId),
    kind: kind as IRuntimeAdapterEvidenceKind,
    references: normalizeReferences(candidate['references'], context.adapterId),
    runtimeName,
    source,
  });
};

const validateEvidenceReferences = async (
  evidence: readonly IRuntimeAdapterEvidence[],
  context: IAdapterValidationState,
): Promise<void> => {
  const entries = new Map<IRepositoryPath, IRepositoryEntry | null>();
  const operationOptions = context.signal === undefined ? undefined : { signal: context.signal };

  for (const item of evidence) {
    for (const reference of item.references) {
      let entry = entries.get(reference.path);

      if (entry === undefined && !entries.has(reference.path)) {
        entry = await context.repository.getEntry(reference.path, operationOptions);
        entries.set(reference.path, entry);
      }

      if (entry?.type !== 'file') {
        return invalidAdapterResult(context.adapterId);
      }
    }
  }
};

const normalizeDiagnostic = (
  candidate: unknown,
  context: IAdapterValidationState,
): IAdapterDiagnostic => {
  if (!isRecord(candidate) || !hasOnlyKeys(candidate, DIAGNOSTIC_KEYS)) {
    return invalidAdapterResult(context.adapterId);
  }

  const source = candidate['source'];
  const severity = candidate['severity'];
  const code = candidate['code'];
  const message = candidate['message'];
  const pathCandidate = candidate['path'];
  const pointer = candidate['pointer'];
  const namespace = `${context.adapterId.toUpperCase().replaceAll('-', '_')}_`;
  const isUnverified = code === `${namespace}RUNTIME_RELATIONSHIP_UNVERIFIED`;

  if (
    source !== context.adapterId ||
    !isSafeString(code) ||
    !ADAPTER_CODE_PATTERN.test(code) ||
    !code.startsWith(namespace) ||
    code.length === namespace.length ||
    (isUnverified
      ? severity !== 'warning' || message !== UNVERIFIED_MESSAGE
      : severity !== 'error') ||
    !isSafeString(message) ||
    message.length === 0 ||
    (pathCandidate !== null &&
      (typeof pathCandidate !== 'string' || !isRepositoryPath(pathCandidate))) ||
    (pointer !== null && (typeof pointer !== 'string' || !isJsonPointer(pointer)))
  ) {
    return invalidAdapterResult(context.adapterId);
  }

  const path = pathCandidate === null ? null : parseRepositoryPath(pathCandidate);
  const range = normalizeRange(candidate['range'], context.adapterId);
  const entity = normalizeEntity(candidate['entity'], context);

  if (path === null && (pointer !== null || range !== null)) {
    return invalidAdapterResult(context.adapterId);
  }

  if (isUnverified) {
    if (path === null) {
      return invalidAdapterResult(context.adapterId);
    }

    return freezeRecursively({
      code,
      details: normalizeWarningDetails(candidate['details'], entity, context),
      entity,
      message,
      path,
      pointer,
      range,
      severity: 'warning' as const,
      source,
    });
  }

  return freezeRecursively({
    code,
    details: normalizeDetails(candidate['details'], context.adapterId),
    entity,
    message,
    path,
    pointer,
    range,
    severity: 'error' as const,
    source,
  });
};

const compareNullableStrings = (left: string | null, right: string | null): number => {
  return left === null
    ? right === null
      ? 0
      : -1
    : right === null
      ? 1
      : compareExactStrings(left, right);
};

const compareEvidence = (left: IRuntimeAdapterEvidence, right: IRuntimeAdapterEvidence): number => {
  const leftReferences = JSON.stringify(
    left.references.map((reference) => [reference.path, reference.symbol ?? null]),
  );
  const rightReferences = JSON.stringify(
    right.references.map((reference) => [reference.path, reference.symbol ?? null]),
  );

  return (
    compareExactStrings(left.source, right.source) ||
    compareExactStrings(left.kind, right.kind) ||
    compareNullableStrings(left.agentId, right.agentId) ||
    compareNullableStrings(left.capabilityKind, right.capabilityKind) ||
    compareNullableStrings(left.capabilityId, right.capabilityId) ||
    compareNullableStrings(left.runtimeName, right.runtimeName) ||
    compareExactStrings(leftReferences, rightReferences) ||
    compareExactStrings(
      serializeDiagnosticDetails(left.details),
      serializeDiagnosticDetails(right.details),
    )
  );
};

const serializeEvidence = (evidence: IRuntimeAdapterEvidence): string => {
  return JSON.stringify([
    evidence.source,
    evidence.kind,
    evidence.agentId,
    evidence.capabilityKind,
    evidence.capabilityId,
    evidence.runtimeName,
    evidence.references.map((reference) => [reference.path, reference.symbol ?? null]),
    serializeDiagnosticDetails(evidence.details),
  ]);
};

/**
 * Deduplicates and sorts normalized evidence from every completed adapter.
 * @param candidates The normalized evidence items to combine.
 * @returns A frozen deterministic evidence collection.
 */
export const normalizeRuntimeAdapterEvidence = (
  candidates: readonly IRuntimeAdapterEvidence[],
): readonly IRuntimeAdapterEvidence[] => {
  const evidence = new Map<string, IRuntimeAdapterEvidence>();

  for (const item of candidates) {
    evidence.set(serializeEvidence(item), item);
  }

  return freezeRecursively([...evidence.values()].sort(compareEvidence));
};

/**
 * Validates and normalizes one untrusted runtime adapter result.
 * @param candidate The result returned by the adapter implementation.
 * @param context The invoking adapter scope, project, reader, limits, and signal.
 * @returns A promise resolving to frozen deterministic evidence and diagnostics.
 * @throws
 * - INVALID_REPOSITORY_PATH: An adapter repository reference path is invalid.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during validation.
 * - INVALID_SOURCE_DATA: The repository reader returned invalid contract data.
 * - RESOURCE_LIMIT_EXCEEDED: A Core or repository resource limit was exceeded.
 * - ABORTED: Adapter validation or a repository operation was aborted.
 * - ADAPTER_EXECUTION_FAILED: The adapter result violates its public contract.
 */
export const validateRuntimeAdapterResult = async (
  candidate: unknown,
  context: IAdapterValidationContext,
  outputCounts: IRuntimeAdapterOutputCounts,
): Promise<IValidatedRuntimeAdapterResult> => {
  let diagnostics: readonly IAdapterDiagnostic[];
  let evidence: readonly IRuntimeAdapterEvidence[];
  let validationState: IAdapterValidationState;

  try {
    if (!isRecord(candidate) || !hasOnlyKeys(candidate, ADAPTER_RESULT_KEYS)) {
      return invalidAdapterResult(context.adapterId);
    }

    const evidenceValue: unknown = candidate['evidence'];
    const diagnosticsValue: unknown = candidate['diagnostics'];

    if (!Array.isArray(evidenceValue) || !Array.isArray(diagnosticsValue)) {
      return invalidAdapterResult(context.adapterId);
    }

    const evidenceCandidates: readonly unknown[] = evidenceValue;
    const diagnosticCandidates: readonly unknown[] = diagnosticsValue;
    registerRawOutput(outputCounts, 'evidence', evidenceCandidates.length, context);
    registerRawOutput(outputCounts, 'diagnostics', diagnosticCandidates.length, context);
    validationState = {
      ...context,
      agentsById: new Map(context.agents.map((agent) => [agent.id, agent])),
      decisionIds: new Set(context.project.decisions.map(({ decision }) => decision.id)),
    };
    diagnostics = diagnosticCandidates.map((diagnostic) =>
      normalizeDiagnostic(diagnostic, validationState),
    );
    evidence = normalizeRuntimeAdapterEvidence(
      evidenceCandidates.map((evidenceCandidate) =>
        normalizeEvidence(evidenceCandidate, validationState),
      ),
    );
  } catch (error: unknown) {
    if (error instanceof CoreOperationException && error.code === 'RESOURCE_LIMIT_EXCEEDED') {
      throw error;
    }

    return invalidAdapterResult(context.adapterId);
  }

  try {
    await validateEvidenceReferences(evidence, validationState);

    return freezeRecursively({
      diagnostics: normalizeDiagnostics(diagnostics),
      evidence,
    });
  } catch (error: unknown) {
    if (
      error instanceof RepositoryPathException ||
      error instanceof RepositorySourceException ||
      error instanceof CoreOperationException
    ) {
      throw error;
    }

    return invalidAdapterResult(context.adapterId);
  }
};
