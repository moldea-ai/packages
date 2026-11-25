import { compareCodePoints } from 'jg-utilities';

import type { IRepositoryPath } from '@moldea.ai/repository';

import type { ICoreResourceLimits } from '../contracts/index.js';
import { CoreOperationException, type ICoreOperation } from '../exceptions/index.js';
import { ACCEPTABLE_WARNING_CODES } from '../constants/index.js';
import {
  escapeJsonPointerSegment,
  type ICoreDiagnosticCollector,
} from '../diagnostic-utilities/index.js';
import type { IDiagnosticEntity, ISourceRange } from '../diagnostics/index.js';
import {
  countUnicodeScalars,
  hasNonWhitespace,
  hasUnsupportedGlobMetacharacter,
  isCanonicalMoldeaPath,
  isCapabilityDescription,
  isContextPath,
  isDecisionPath,
  isMirrorPath,
  isNonEmptySingleLine,
  isRepositorySymbol,
  isReservedId,
  isSimpleGlob,
  isStableId,
  parseManifestPath,
} from '../format-validation/index.js';
import type {
  IAcceptedWarningManifestEntry,
  IAgentBindingsManifestEntry,
  IAgentManifestEntry,
  IMoldeaManifestV1,
  IRelationshipManifestEntry,
  IRepositoryFormatVersion,
  IRepositoryReference,
  ISkillManifestEntry,
  IToolManifestEntry,
} from '../format/index.js';
import { createNullPrototypeRecord } from '../immutable/index.js';
import type { IYamlNode, IYamlScalarNode } from '../yaml/index.js';

interface IManifestValidationContext {
  readonly diagnostics: ICoreDiagnosticCollector;
  readonly mirrorPaths: Set<string>;
  readonly path: IRepositoryPath;
  readonly limits: ICoreResourceLimits;
  readonly operation: ICoreOperation;
}

interface IMappingEntry {
  readonly key: IYamlScalarNode;
  readonly value: IYamlNode;
}

const childPointer = (pointer: string, key: string): string => {
  return `${pointer}/${escapeJsonPointerSegment(key)}`;
};

const addInvalidValue = (
  context: IManifestValidationContext,
  pointer: string,
  range: ISourceRange | null,
  reason: string,
  entity: IDiagnosticEntity | null = null,
): void => {
  context.diagnostics.add({
    code: 'MOLDEA_MANIFEST_VALUE_INVALID',
    details: { reason },
    entity,
    path: context.path,
    pointer,
    range,
  });
};

const readMapping = (
  node: IYamlNode,
  pointer: string,
  allowedProperties: ReadonlySet<string> | null,
  context: IManifestValidationContext,
  entity: IDiagnosticEntity | null = null,
): ReadonlyMap<string, IMappingEntry> | null => {
  if (node.kind !== 'mapping') {
    addInvalidValue(context, pointer, node.range, 'mapping-required', entity);
    return null;
  }

  const entries = new Map<string, IMappingEntry>();

  for (const entry of node.entries) {
    if (entry.key.kind !== 'scalar' || typeof entry.key.value !== 'string') {
      addInvalidValue(context, pointer, entry.key.range, 'string-key-required', entity);
      continue;
    }

    const key = entry.key.value;

    if (allowedProperties !== null && !allowedProperties.has(key)) {
      context.diagnostics.add({
        code: 'MOLDEA_MANIFEST_PROPERTY_UNKNOWN',
        entity,
        path: context.path,
        pointer: childPointer(pointer, key),
        range: entry.key.range,
      });
      continue;
    }

    entries.set(key, { key: entry.key, value: entry.value });
  }

  return entries;
};

const readString = (
  entry: IMappingEntry | undefined,
  pointer: string,
  context: IManifestValidationContext,
  options: {
    readonly entity?: IDiagnosticEntity;
    readonly required?: boolean;
    readonly singleLine?: boolean;
  } = {},
): string | null => {
  if (entry === undefined) {
    if (options.required === true) {
      addInvalidValue(context, pointer, null, 'required', options.entity ?? null);
    }

    return null;
  }

  if (entry.value.kind !== 'scalar' || typeof entry.value.value !== 'string') {
    addInvalidValue(context, pointer, entry.value.range, 'string-required', options.entity ?? null);
    return null;
  }

  const value = entry.value.value;

  if (!hasNonWhitespace(value) || (options.singleLine === true && !isNonEmptySingleLine(value))) {
    addInvalidValue(context, pointer, entry.value.range, 'string-invalid', options.entity ?? null);
    return null;
  }

  return value;
};

const validateStableId = (
  value: string,
  range: ISourceRange,
  pointer: string,
  context: IManifestValidationContext,
  entity: IDiagnosticEntity | null = null,
): boolean => {
  if (!isStableId(value)) {
    context.diagnostics.add({
      code: 'MOLDEA_ID_INVALID',
      entity,
      path: context.path,
      pointer,
      range,
    });
    return false;
  }

  if (isReservedId(value)) {
    context.diagnostics.add({
      code: 'MOLDEA_ID_RESERVED',
      entity,
      path: context.path,
      pointer,
      range,
    });
    return false;
  }

  return true;
};

const readReference = (
  node: IYamlNode,
  pointer: string,
  context: IManifestValidationContext,
  entity: IDiagnosticEntity | null = null,
): IRepositoryReference | null => {
  const entries = readMapping(node, pointer, new Set(['path', 'symbol']), context, entity);

  if (entries === null) {
    return null;
  }

  const pathEntry = entries.get('path');

  if (pathEntry?.value.kind !== 'scalar' || typeof pathEntry.value.value !== 'string') {
    context.diagnostics.add({
      code: 'MOLDEA_PATH_INVALID',
      details: { reason: pathEntry === undefined ? 'missing' : 'type' },
      entity,
      path: context.path,
      pointer: childPointer(pointer, 'path'),
      range: pathEntry?.value.range ?? null,
    });
    return null;
  }

  const path = parseManifestPath(pathEntry.value.value);

  if (path === null) {
    context.diagnostics.add({
      code: 'MOLDEA_PATH_INVALID',
      entity,
      path: context.path,
      pointer: childPointer(pointer, 'path'),
      range: pathEntry.value.range,
    });
    return null;
  }

  const symbolEntry = entries.get('symbol');

  if (symbolEntry === undefined) {
    return { path };
  }

  if (
    symbolEntry.value.kind !== 'scalar' ||
    typeof symbolEntry.value.value !== 'string' ||
    !isRepositorySymbol(symbolEntry.value.value)
  ) {
    context.diagnostics.add({
      code: 'MOLDEA_SYMBOL_INVALID',
      entity,
      path: context.path,
      pointer: childPointer(pointer, 'symbol'),
      range: symbolEntry.value.range,
    });
    return null;
  }

  if (isCanonicalMoldeaPath(path)) {
    context.diagnostics.add({
      code: 'MOLDEA_SYMBOL_FORBIDDEN',
      entity,
      path: context.path,
      pointer: childPointer(pointer, 'symbol'),
      range: symbolEntry.value.range,
    });
    return null;
  }

  return { path, symbol: symbolEntry.value.value };
};

const readReferenceList = (
  node: IYamlNode,
  pointer: string,
  context: IManifestValidationContext,
  entity: IDiagnosticEntity | null = null,
): readonly IRepositoryReference[] => {
  if (node.kind !== 'sequence' || node.items.length === 0) {
    addInvalidValue(context, pointer, node.range, 'non-empty-sequence-required', entity);
    return [];
  }

  const references: IRepositoryReference[] = [];
  const seen = new Set<string>();

  node.items.forEach((item, index) => {
    const reference = readReference(item, childPointer(pointer, String(index)), context, entity);

    if (reference === null) {
      return;
    }

    const key = `${reference.path}\0${reference.symbol ?? ''}`;

    if (seen.has(key)) {
      context.diagnostics.add({
        code: 'MOLDEA_PATH_DUPLICATE',
        entity,
        path: context.path,
        pointer: childPointer(pointer, String(index)),
        range: item.range,
      });
      return;
    }

    seen.add(key);
    references.push(reference);
  });

  return references;
};

const readAffectedBy = (
  node: IYamlNode,
  pointer: string,
  context: IManifestValidationContext,
  entity: IDiagnosticEntity | null = null,
): readonly string[] => {
  if (node.kind !== 'sequence' || node.items.length === 0) {
    addInvalidValue(context, pointer, node.range, 'non-empty-sequence-required', entity);
    return [];
  }

  const values: string[] = [];
  const seen = new Set<string>();

  node.items.forEach((item, index) => {
    const itemPointer = childPointer(pointer, String(index));

    if (item.kind !== 'scalar' || typeof item.value !== 'string') {
      addInvalidValue(context, itemPointer, item.range, 'string-required', entity);
      return;
    }

    const isGlob = item.value.includes('*') || hasUnsupportedGlobMetacharacter(item.value);
    const isValid = isGlob ? isSimpleGlob(item.value) : parseManifestPath(item.value) !== null;

    if (!isValid) {
      context.diagnostics.add({
        code: isGlob ? 'MOLDEA_GLOB_INVALID' : 'MOLDEA_PATH_INVALID',
        entity,
        path: context.path,
        pointer: itemPointer,
        range: item.range,
      });
      return;
    }

    if (seen.has(item.value)) {
      context.diagnostics.add({
        code: isGlob ? 'MOLDEA_PATTERN_DUPLICATE' : 'MOLDEA_PATH_DUPLICATE',
        entity,
        path: context.path,
        pointer: itemPointer,
        range: item.range,
      });
      return;
    }

    seen.add(item.value);
    values.push(item.value);
  });

  return values;
};

const readRelationship = (
  node: IYamlNode,
  pointer: string,
  context: IManifestValidationContext,
): IRelationshipManifestEntry | null => {
  const entries = readMapping(node, pointer, new Set(['affectedBy', 'bindings']), context);

  if (entries === null) {
    return null;
  }

  const bindingsEntry = entries.get('bindings');
  const affectedByEntry = entries.get('affectedBy');

  if (bindingsEntry === undefined && affectedByEntry === undefined) {
    context.diagnostics.add({
      code: 'MOLDEA_CONTEXT_RELATIONSHIP_EMPTY',
      path: context.path,
      pointer,
      range: node.range,
    });
  }

  return {
    ...(bindingsEntry === undefined
      ? {}
      : {
          bindings: readReferenceList(
            bindingsEntry.value,
            childPointer(pointer, 'bindings'),
            context,
          ),
        }),
    ...(affectedByEntry === undefined
      ? {}
      : {
          affectedBy: readAffectedBy(
            affectedByEntry.value,
            childPointer(pointer, 'affectedBy'),
            context,
          ),
        }),
  };
};

const readRelationshipRecord = (
  node: IYamlNode,
  pointer: string,
  kind: 'context' | 'decision',
  context: IManifestValidationContext,
): Readonly<Record<string, IRelationshipManifestEntry>> | null => {
  const entries = readMapping(node, pointer, null, context);

  if (entries === null) {
    return null;
  }

  const normalized: Array<readonly [string, IRelationshipManifestEntry]> = [];

  for (const [key, entry] of [...entries].sort(([left], [right]) =>
    compareCodePoints(left, right),
  )) {
    const path = parseManifestPath(key);
    const validPath =
      path !== null && (kind === 'context' ? isContextPath(path, true) : isDecisionPath(path));

    if (!validPath) {
      context.diagnostics.add({
        code:
          kind === 'context' ? 'MOLDEA_CONTEXT_PATH_INVALID' : 'MOLDEA_DECISION_FILENAME_INVALID',
        path: context.path,
        pointer: childPointer(pointer, key),
        range: entry.key.range,
      });
      continue;
    }

    const relationship = readRelationship(entry.value, childPointer(pointer, key), context);

    if (relationship !== null) {
      normalized.push([key, relationship]);
    }
  }

  return createNullPrototypeRecord(normalized);
};

const readPathList = (
  node: IYamlNode,
  pointer: string,
  kind: 'context' | 'decision' | 'mirror',
  context: IManifestValidationContext,
  entity: IDiagnosticEntity,
): readonly IRepositoryPath[] => {
  if (node.kind !== 'sequence') {
    addInvalidValue(context, pointer, node.range, 'sequence-required', entity);
    return [];
  }

  const paths: IRepositoryPath[] = [];
  const seen = new Set<string>();

  node.items.forEach((item, index) => {
    const itemPointer = childPointer(pointer, String(index));

    if (item.kind !== 'scalar' || typeof item.value !== 'string') {
      addInvalidValue(context, itemPointer, item.range, 'string-required', entity);
      return;
    }

    const path = parseManifestPath(item.value);
    const valid =
      path !== null &&
      (kind === 'context'
        ? isContextPath(path, false)
        : kind === 'decision'
          ? isDecisionPath(path)
          : isMirrorPath(path));

    if (!valid || path === null) {
      const code =
        kind === 'context'
          ? 'MOLDEA_CONTEXT_PATH_INVALID'
          : kind === 'decision'
            ? 'MOLDEA_DECISION_FILENAME_INVALID'
            : path !== null && !isMirrorPath(path)
              ? 'MOLDEA_MIRROR_PATH_INSIDE_MOLDEA'
              : 'MOLDEA_MIRROR_PATH_INVALID';
      context.diagnostics.add({
        code,
        entity,
        path: context.path,
        pointer: itemPointer,
        range: item.range,
      });
      return;
    }

    if (seen.has(path)) {
      context.diagnostics.add({
        code: kind === 'mirror' ? 'MOLDEA_MIRROR_PATH_DUPLICATE' : 'MOLDEA_PATH_DUPLICATE',
        entity,
        path: context.path,
        pointer: itemPointer,
        range: item.range,
      });
      return;
    }

    if (kind === 'mirror' && context.mirrorPaths.has(path)) {
      context.diagnostics.add({
        code: 'MOLDEA_MIRROR_PATH_DUPLICATE',
        entity,
        path: context.path,
        pointer: itemPointer,
        range: item.range,
      });
      return;
    }

    seen.add(path);
    if (kind === 'mirror') {
      context.mirrorPaths.add(path);
    }
    paths.push(path);
  });

  return paths;
};

const readBindings = (
  node: IYamlNode,
  pointer: string,
  context: IManifestValidationContext,
  agentId: string,
): IAgentBindingsManifestEntry | null => {
  const entity = { agentId };
  const entries = readMapping(
    node,
    pointer,
    new Set(['inputSchema', 'instructionLoader', 'outputSchema', 'runtimeAgent']),
    context,
    entity,
  );

  if (entries === null) {
    return null;
  }

  const referenceProperty = (
    key: 'inputSchema' | 'instructionLoader' | 'outputSchema' | 'runtimeAgent',
  ) => {
    const entry = entries.get(key);
    return entry === undefined
      ? null
      : readReference(entry.value, childPointer(pointer, key), context, entity);
  };
  const inputSchema = referenceProperty('inputSchema');
  const instructionLoader = referenceProperty('instructionLoader');
  const outputSchema = referenceProperty('outputSchema');
  const runtimeAgent = referenceProperty('runtimeAgent');
  return {
    ...(runtimeAgent === null ? {} : { runtimeAgent }),
    ...(inputSchema === null ? {} : { inputSchema }),
    ...(outputSchema === null ? {} : { outputSchema }),
    ...(instructionLoader === null ? {} : { instructionLoader }),
  };
};

const readCapability = (
  node: IYamlNode,
  pointer: string,
  context: IManifestValidationContext,
  agentId: string,
  capabilityId: string,
  kind: 'tool' | 'skill',
): IToolManifestEntry | ISkillManifestEntry | null => {
  const entity = { agentId, capabilityId, capabilityKind: kind } as const;
  const allowed =
    kind === 'tool'
      ? new Set([
          'affectedBy',
          'description',
          'implementation',
          'inputSchema',
          'name',
          'outputSchema',
          'registration',
        ])
      : new Set(['affectedBy', 'description', 'implementation', 'name', 'registration']);
  const entries = readMapping(node, pointer, allowed, context, entity);

  if (entries === null) {
    return null;
  }

  const name = readString(entries.get('name'), childPointer(pointer, 'name'), context, {
    entity,
    required: true,
    singleLine: true,
  });
  const descriptionEntry = entries.get('description');
  let description: string | null = null;

  if (descriptionEntry === undefined) {
    context.diagnostics.add({
      code: 'MOLDEA_CAPABILITY_DESCRIPTION_MISSING',
      entity,
      path: context.path,
      pointer: childPointer(pointer, 'description'),
    });
  } else if (
    descriptionEntry.value.kind !== 'scalar' ||
    typeof descriptionEntry.value.value !== 'string' ||
    !isCapabilityDescription(descriptionEntry.value.value)
  ) {
    context.diagnostics.add({
      code: 'MOLDEA_CAPABILITY_DESCRIPTION_INVALID',
      entity,
      path: context.path,
      pointer: childPointer(pointer, 'description'),
      range: descriptionEntry.value.range,
    });
  } else {
    description = descriptionEntry.value.value;
  }

  const implementationEntry = entries.get('implementation');
  let implementation: IRepositoryReference | null = null;

  if (implementationEntry === undefined) {
    context.diagnostics.add({
      code:
        kind === 'tool'
          ? 'MOLDEA_TOOL_IMPLEMENTATION_MISSING'
          : 'MOLDEA_SKILL_IMPLEMENTATION_MISSING',
      entity,
      path: context.path,
      pointer: childPointer(pointer, 'implementation'),
    });
  } else {
    implementation = readReference(
      implementationEntry.value,
      childPointer(pointer, 'implementation'),
      context,
      entity,
    );
  }

  const optionalReference = (key: 'inputSchema' | 'outputSchema' | 'registration') => {
    const entry = entries.get(key);
    return entry === undefined
      ? null
      : readReference(entry.value, childPointer(pointer, key), context, entity);
  };
  const registration = optionalReference('registration');
  const inputSchema = kind === 'tool' ? optionalReference('inputSchema') : null;
  const outputSchema = kind === 'tool' ? optionalReference('outputSchema') : null;
  const affectedByEntry = entries.get('affectedBy');
  const affectedBy =
    affectedByEntry === undefined
      ? null
      : readAffectedBy(affectedByEntry.value, childPointer(pointer, 'affectedBy'), context, entity);

  if (name === null || description === null || implementation === null) {
    return null;
  }

  return {
    name,
    description,
    implementation,
    ...(registration === null ? {} : { registration }),
    ...(inputSchema === null ? {} : { inputSchema }),
    ...(outputSchema === null ? {} : { outputSchema }),
    ...(affectedBy === null ? {} : { affectedBy }),
  };
};

const readCapabilities = <Value extends IToolManifestEntry | ISkillManifestEntry>(
  node: IYamlNode,
  pointer: string,
  context: IManifestValidationContext,
  agentId: string,
  kind: 'tool' | 'skill',
): Readonly<Record<string, Value>> | null => {
  const entries = readMapping(node, pointer, null, context, { agentId });

  if (entries === null) {
    return null;
  }

  const normalized: Array<readonly [string, Value]> = [];

  for (const [capabilityId, entry] of [...entries].sort(([left], [right]) =>
    compareCodePoints(left, right),
  )) {
    const entity = { agentId, capabilityId, capabilityKind: kind } as const;
    const capabilityPointer = childPointer(pointer, capabilityId);
    validateStableId(capabilityId, entry.key.range, capabilityPointer, context, entity);
    const capability = readCapability(
      entry.value,
      capabilityPointer,
      context,
      agentId,
      capabilityId,
      kind,
    );

    if (capability !== null) {
      normalized.push([capabilityId, capability as Value]);
    }
  }

  return createNullPrototypeRecord(normalized);
};

const findMappingProperty = (node: IYamlNode, property: string): IYamlNode | null => {
  if (node.kind !== 'mapping') {
    return null;
  }

  for (const entry of node.entries) {
    if (entry.key.kind === 'scalar' && entry.key.value === property) {
      return entry.value;
    }
  }

  return null;
};

/**
 * Detects a supported repository-format version without treating the remaining manifest as valid.
 * @param node The trustworthy strict-YAML manifest root.
 * @returns The supported parsed version when its declaration is independently unambiguous.
 */
export const detectSupportedManifestVersion = (
  node: IYamlNode,
): IRepositoryFormatVersion | null => {
  if (node.kind !== 'mapping') {
    return null;
  }

  const versionNode = findMappingProperty(node, 'version');

  return versionNode?.kind === 'scalar' && versionNode.value === 1n ? 1 : null;
};

const validateAgentOwnedIdUniqueness = (
  node: IYamlNode,
  pointer: string,
  context: IManifestValidationContext,
  agentId: string,
): void => {
  const seen = new Set<string>();

  for (const property of ['tools', 'skills']) {
    const record = findMappingProperty(node, property);

    if (record?.kind !== 'mapping') {
      continue;
    }

    for (const entry of record.entries) {
      if (entry.key.kind !== 'scalar' || typeof entry.key.value !== 'string') {
        continue;
      }

      if (seen.has(entry.key.value)) {
        context.diagnostics.add({
          code: 'MOLDEA_ID_DUPLICATE',
          entity: { agentId },
          path: context.path,
          pointer: childPointer(childPointer(pointer, property), entry.key.value),
          range: entry.key.range,
        });
      }

      seen.add(entry.key.value);
    }
  }
};

const readAgent = (
  node: IYamlNode,
  pointer: string,
  context: IManifestValidationContext,
  agentId: string,
): IAgentManifestEntry | null => {
  const entity = { agentId };
  const entries = readMapping(
    node,
    pointer,
    new Set(['affectedBy', 'bindings', 'context', 'decisions', 'mirrors', 'skills', 'tools']),
    context,
    entity,
  );

  if (entries === null) {
    return null;
  }

  validateAgentOwnedIdUniqueness(node, pointer, context, agentId);
  const bindingsEntry = entries.get('bindings');
  const bindings =
    bindingsEntry === undefined
      ? null
      : readBindings(bindingsEntry.value, childPointer(pointer, 'bindings'), context, agentId);
  const contextEntry = entries.get('context');
  const contextPaths =
    contextEntry === undefined
      ? null
      : readPathList(
          contextEntry.value,
          childPointer(pointer, 'context'),
          'context',
          context,
          entity,
        );
  const decisionsEntry = entries.get('decisions');
  const decisions =
    decisionsEntry === undefined
      ? null
      : readPathList(
          decisionsEntry.value,
          childPointer(pointer, 'decisions'),
          'decision',
          context,
          entity,
        );
  const toolsEntry = entries.get('tools');
  const tools =
    toolsEntry === undefined
      ? null
      : readCapabilities<IToolManifestEntry>(
          toolsEntry.value,
          childPointer(pointer, 'tools'),
          context,
          agentId,
          'tool',
        );
  const skillsEntry = entries.get('skills');
  const skills =
    skillsEntry === undefined
      ? null
      : readCapabilities<ISkillManifestEntry>(
          skillsEntry.value,
          childPointer(pointer, 'skills'),
          context,
          agentId,
          'skill',
        );
  const affectedByEntry = entries.get('affectedBy');
  const affectedBy =
    affectedByEntry === undefined
      ? null
      : readAffectedBy(affectedByEntry.value, childPointer(pointer, 'affectedBy'), context, entity);
  const mirrorsEntry = entries.get('mirrors');
  const mirrors =
    mirrorsEntry === undefined
      ? null
      : readPathList(
          mirrorsEntry.value,
          childPointer(pointer, 'mirrors'),
          'mirror',
          context,
          entity,
        );
  return {
    ...(contextPaths === null ? {} : { context: contextPaths }),
    ...(decisions === null ? {} : { decisions }),
    ...(bindings === null ? {} : { bindings }),
    ...(tools === null ? {} : { tools }),
    ...(skills === null ? {} : { skills }),
    ...(affectedBy === null ? {} : { affectedBy }),
    ...(mirrors === null ? {} : { mirrors }),
  };
};

const readAgents = (
  node: IYamlNode,
  pointer: string,
  context: IManifestValidationContext,
): Readonly<Record<string, IAgentManifestEntry>> | null => {
  const entries = readMapping(node, pointer, null, context);

  if (entries === null) {
    return null;
  }

  const normalized: Array<readonly [string, IAgentManifestEntry]> = [];

  for (const [agentId, entry] of [...entries].sort(([left], [right]) =>
    compareCodePoints(left, right),
  )) {
    const agentPointer = childPointer(pointer, agentId);
    validateStableId(agentId, entry.key.range, agentPointer, context, { agentId });
    const agent = readAgent(entry.value, agentPointer, context, agentId);

    if (agent !== null) {
      normalized.push([agentId, agent]);
    }
  }

  return createNullPrototypeRecord(normalized);
};

/**
 * Validates the closed warning-acceptance contract with field-specific diagnostics.
 * @returns Valid acceptance entries; diagnostics invalidate the complete manifest on any bad entry.
 * @throws
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 */
const readAcceptedWarnings = (
  node: IYamlNode,
  context: IManifestValidationContext,
): IAcceptedWarningManifestEntry[] | null => {
  const report = (
    entry: number | null,
    field: string,
    range: ISourceRange,
    reason: string,
  ): void => {
    context.diagnostics.add({
      code: 'MOLDEA_MANIFEST_VALUE_INVALID',
      path: context.path,
      pointer:
        entry === null
          ? '/acceptedWarnings'
          : `/acceptedWarnings/${entry}/${escapeJsonPointerSegment(field)}`,
      range,
      details: { entry, field, reason },
    });
  };
  if (node.kind !== 'sequence') {
    report(null, 'acceptedWarnings', node.range, 'sequence-required');
    return null;
  }
  if (node.items.length > context.limits.maxAcceptedWarnings)
    throw new CoreOperationException({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      operation: context.operation,
      limit: 'maxAcceptedWarnings',
      limitMaximum: context.limits.maxAcceptedWarnings,
      observedUsage: node.items.length,
      nextAction: 'reduce-input-or-increase-limit',
    });
  const accepted: IAcceptedWarningManifestEntry[] = [];
  const identities = new Set<string>();
  for (const [index, item] of node.items.entries()) {
    if (item.kind !== 'mapping') {
      report(index, 'entry', item.range, 'mapping-required');
      continue;
    }
    const fields = new Map<string, IYamlNode>();
    let isValid = true;
    for (const entry of item.entries) {
      if (
        entry.key.kind !== 'scalar' ||
        typeof entry.key.value !== 'string' ||
        !['code', 'subject', 'qualifier', 'reason'].includes(entry.key.value)
      ) {
        report(
          index,
          entry.key.kind === 'scalar' && typeof entry.key.value === 'string'
            ? entry.key.value
            : 'key',
          entry.key.range,
          'unknown-field',
        );
        isValid = false;
      } else fields.set(entry.key.value, entry.value);
    }
    const scalar = (field: string): string | null => {
      const value = fields.get(field);
      if (
        value?.kind !== 'scalar' ||
        typeof value.value !== 'string' ||
        !hasNonWhitespace(value.value)
      ) {
        report(
          index,
          field,
          value?.range ?? item.range,
          value === undefined ? 'required' : 'non-empty-string-required',
        );
        isValid = false;
        return null;
      }
      return value.value;
    };
    const code = scalar('code');
    const subjectText = scalar('subject');
    const reason = scalar('reason');
    const subject = subjectText === null ? null : parseManifestPath(subjectText);
    const qualifierNode = fields.get('qualifier');
    let qualifier: string | null = null;
    if (
      qualifierNode !== undefined &&
      !(qualifierNode.kind === 'scalar' && qualifierNode.value === null)
    ) {
      qualifier = scalar('qualifier');
      if (qualifier !== null && !isNonEmptySingleLine(qualifier)) {
        report(index, 'qualifier', qualifierNode.range, 'single-line-required');
        isValid = false;
      }
    }
    const acceptedCode = ACCEPTABLE_WARNING_CODES.find((candidate) => candidate === code);
    if (code !== null && acceptedCode === undefined) {
      report(index, 'code', fields.get('code')!.range, 'code-not-acceptable');
      isValid = false;
    }
    if (subjectText !== null && subject === null) {
      report(index, 'subject', fields.get('subject')!.range, 'repository-path-required');
      isValid = false;
    }
    if (reason !== null && countUnicodeScalars(reason) > 256) {
      report(index, 'reason', fields.get('reason')!.range, 'maximum-256-characters');
      isValid = false;
    }
    if (!isValid || acceptedCode === undefined || subject === null || reason === null) continue;
    const identity = JSON.stringify([acceptedCode, subject, qualifier]);
    if (identities.has(identity)) {
      report(index, 'code', fields.get('code')!.range, 'duplicate-identity');
      continue;
    }
    identities.add(identity);
    accepted.push({
      code: acceptedCode,
      subject,
      ...(qualifierNode === undefined ? {} : { qualifier }),
      reason,
    });
  }
  return accepted;
};

/**
 * Validates and normalizes a strict YAML document as a version 1 moldea manifest.
 * @param node The parser-neutral YAML root node.
 * @param path The canonical or caller-supplied logical manifest path.
 * @param diagnostics The operation diagnostic collector.
 * @param limits The immutable operation limits, including the acceptance-list bound.
 * @param operation The public operation receiving resource failures.
 * @returns The normalized manifest when its supported version can be interpreted.
 * @throws
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 */
export const validateManifest = (
  node: IYamlNode,
  path: IRepositoryPath,
  diagnostics: ICoreDiagnosticCollector,
  limits: ICoreResourceLimits,
  operation: ICoreOperation,
): IMoldeaManifestV1 | null => {
  const context: IManifestValidationContext = {
    diagnostics,
    operation,
    limits,
    mirrorPaths: new Set(),
    path,
  };

  if (node.kind !== 'mapping') {
    diagnostics.add({ code: 'MOLDEA_MANIFEST_ROOT_INVALID', path, range: node.range });
    return null;
  }

  const versionNode = findMappingProperty(node, 'version');

  if (versionNode === null) {
    diagnostics.add({ code: 'MOLDEA_MANIFEST_VERSION_MISSING', path, pointer: '/version' });
    return null;
  }

  const isIntegerSyntax = versionNode.kind === 'scalar' && typeof versionNode.value === 'bigint';

  if (!isIntegerSyntax || versionNode.kind !== 'scalar' || versionNode.value <= 0n) {
    diagnostics.add({
      code: 'MOLDEA_MANIFEST_VERSION_INVALID',
      path,
      pointer: '/version',
      range: versionNode.range,
    });
    return null;
  }

  if (versionNode.value !== 1n) {
    diagnostics.add({
      code: 'MOLDEA_MANIFEST_VERSION_UNSUPPORTED',
      path,
      pointer: '/version',
      range: versionNode.range,
    });
    return null;
  }

  const entries = readMapping(
    node,
    '',
    new Set(['acceptedWarnings', 'agents', 'context', 'decisions', 'version']),
    context,
  );

  if (entries === null) {
    return null;
  }

  const acceptedWarningsEntry = entries.get('acceptedWarnings');
  const acceptedWarnings =
    acceptedWarningsEntry === undefined
      ? null
      : readAcceptedWarnings(acceptedWarningsEntry.value, context);
  const contextEntry = entries.get('context');
  const contextRelationships =
    contextEntry === undefined
      ? null
      : readRelationshipRecord(contextEntry.value, '/context', 'context', context);
  const decisionsEntry = entries.get('decisions');
  const decisionRelationships =
    decisionsEntry === undefined
      ? null
      : readRelationshipRecord(decisionsEntry.value, '/decisions', 'decision', context);
  const agentsEntry = entries.get('agents');
  const agents =
    agentsEntry === undefined ? null : readAgents(agentsEntry.value, '/agents', context);

  return {
    version: 1,
    ...(acceptedWarnings === null ? {} : { acceptedWarnings }),
    ...(contextRelationships === null ? {} : { context: contextRelationships }),
    ...(decisionRelationships === null ? {} : { decisions: decisionRelationships }),
    ...(agents === null ? {} : { agents }),
  };
};
