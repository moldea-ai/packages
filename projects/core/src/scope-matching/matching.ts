import type { IRepositoryPath } from '@moldea.ai/repository';

import type { IContentDigest, ICoreResourceLimits } from '../contracts/index.js';
import { escapeJsonPointerSegment } from '../diagnostic-utilities/index.js';
import { CoreOperationException } from '../exceptions/index.js';
import { compareExactStrings, countUnicodeScalars } from '../format-validation/index.js';
import type {
  IAgentManifestEntry,
  IMoldeaManifestV1,
  IRepositoryReference,
  ISkillManifestEntry,
  IToolManifestEntry,
  IUnresolvedRequirementManifestEntry,
} from '../format/index.js';
import { freezeRecursively } from '../immutable/index.js';
import { calculateNormalizedTextDigest } from '../text/index.js';

import type {
  IManifestScopeCounts,
  IManifestScopeDeclaration,
  IManifestScopeMatch,
  IManifestScopeOwner,
  IManifestScopeRelationshipField,
} from './types.js';
import { measureUtf8ByteLength } from './validations.js';

interface IManifestScopeRelationshipDeclaration {
  readonly owner: IManifestScopeOwner;
  readonly field: IManifestScopeRelationshipField;
  readonly pointer: string;
  readonly declaration: IManifestScopeDeclaration;
}

interface ICompiledGlobDeclaration {
  readonly declaration: IManifestScopeRelationshipDeclaration;
  readonly segments: readonly string[];
}

interface ICompiledManifestScope {
  readonly declarations: readonly IManifestScopeRelationshipDeclaration[];
  readonly exact: ReadonlyMap<IRepositoryPath, readonly IManifestScopeRelationshipDeclaration[]>;
  readonly globalGlobs: readonly ICompiledGlobDeclaration[];
  readonly globsByFirstSegment: ReadonlyMap<string, readonly ICompiledGlobDeclaration[]>;
}

type IManifestCapability =
  | { readonly kind: 'skill'; readonly value: ISkillManifestEntry }
  | { readonly kind: 'tool'; readonly value: IToolManifestEntry };

const childPointer = (pointer: string, segment: string): string => {
  return `${pointer}/${escapeJsonPointerSegment(segment)}`;
};

const createOwner = (
  kind: IManifestScopeOwner['kind'],
  id: string,
  agentId: string | null = null,
): IManifestScopeOwner => ({ agentId, id, kind });

const compareOwners = (left: IManifestScopeOwner, right: IManifestScopeOwner): number => {
  return (
    compareExactStrings(left.kind, right.kind) ||
    compareExactStrings(left.agentId ?? '', right.agentId ?? '') ||
    compareExactStrings(left.id, right.id)
  );
};

const getDeclarationValue = (declaration: IManifestScopeDeclaration): string => {
  return declaration.kind === 'exact' ? declaration.path : declaration.pattern;
};

const compareDeclarations = (
  left: IManifestScopeRelationshipDeclaration,
  right: IManifestScopeRelationshipDeclaration,
): number => {
  return (
    compareOwners(left.owner, right.owner) ||
    compareExactStrings(left.field, right.field) ||
    compareExactStrings(
      getDeclarationValue(left.declaration),
      getDeclarationValue(right.declaration),
    ) ||
    compareExactStrings(left.pointer, right.pointer)
  );
};

/** Adds one exact repository relationship to the normalized declaration collection. */
const addExactDeclaration = (
  declarations: IManifestScopeRelationshipDeclaration[],
  owner: IManifestScopeOwner,
  field: IManifestScopeRelationshipField,
  pointer: string,
  reference: IRepositoryReference | IRepositoryPath,
): void => {
  declarations.push({
    declaration:
      typeof reference === 'string'
        ? { kind: 'exact', path: reference, symbol: null }
        : { kind: 'exact', path: reference.path, symbol: reference.symbol ?? null },
    field,
    owner,
    pointer,
  });
};

/** Adds sorted repository references while preserving normalized declaration pointers. */
const addReferenceDeclarations = (
  declarations: IManifestScopeRelationshipDeclaration[],
  references: readonly IRepositoryReference[] | undefined,
  owner: IManifestScopeOwner,
  field: IManifestScopeRelationshipField,
  pointer: string,
): void => {
  for (const [index, reference] of (references ?? []).entries()) {
    addExactDeclaration(
      declarations,
      owner,
      field,
      childPointer(pointer, String(index)),
      reference,
    );
  }
};

/** Adds exact and simple-glob impact relationships in normalized array order. */
const addAffectedByDeclarations = (
  declarations: IManifestScopeRelationshipDeclaration[],
  affectedBy: readonly string[] | undefined,
  owner: IManifestScopeOwner,
  pointer: string,
): void => {
  for (const [index, pattern] of (affectedBy ?? []).entries()) {
    declarations.push({
      declaration: pattern.includes('*')
        ? { kind: 'glob', pattern }
        : { kind: 'exact', path: pattern as IRepositoryPath, symbol: null },
      field: 'affectedBy',
      owner,
      pointer: childPointer(pointer, String(index)),
    });
  }
};

/** Adds project-level or agent-level unresolved requirement references. */
const addUnresolvedDeclarations = (
  declarations: IManifestScopeRelationshipDeclaration[],
  requirements: Readonly<Record<string, IUnresolvedRequirementManifestEntry>> | undefined,
  pointer: string,
  agentId: string | null,
): void => {
  for (const requirementId of Object.keys(requirements ?? {}).sort(compareExactStrings)) {
    const requirement = requirements?.[requirementId];

    if (requirement === undefined) {
      continue;
    }

    const owner = createOwner('unresolved', requirementId, agentId);
    addReferenceDeclarations(
      declarations,
      requirement.related,
      owner,
      'related',
      childPointer(childPointer(pointer, requirementId), 'related'),
    );
  }
};

/** Adds exact and impact declarations owned by one tool or skill capability. */
const addCapabilityDeclarations = (
  declarations: IManifestScopeRelationshipDeclaration[],
  capabilityId: string,
  capability: IManifestCapability,
  agentId: string,
  pointer: string,
): void => {
  const owner = createOwner(capability.kind, capabilityId, agentId);
  addExactDeclaration(
    declarations,
    owner,
    'implementation',
    childPointer(pointer, 'implementation'),
    capability.value.implementation,
  );

  if (capability.value.registration !== undefined) {
    addExactDeclaration(
      declarations,
      owner,
      'registration',
      childPointer(pointer, 'registration'),
      capability.value.registration,
    );
  }

  if (capability.kind === 'tool') {
    for (const field of ['inputSchema', 'outputSchema'] as const) {
      const reference = capability.value[field];

      if (reference !== undefined) {
        addExactDeclaration(declarations, owner, field, childPointer(pointer, field), reference);
      }
    }
  }

  addAffectedByDeclarations(
    declarations,
    capability.value.affectedBy,
    owner,
    childPointer(pointer, 'affectedBy'),
  );
};

/** Adds all exact and impact relationships owned by one registered agent. */
const addAgentDeclarations = (
  declarations: IManifestScopeRelationshipDeclaration[],
  agentId: string,
  agent: IAgentManifestEntry,
): void => {
  const pointer = childPointer('/agents', agentId);
  const owner = createOwner('agent', agentId, agentId);
  const bindingsPointer = childPointer(pointer, 'bindings');

  for (const field of [
    'runtimeAgent',
    'inputSchema',
    'outputSchema',
    'instructionLoader',
  ] as const) {
    const reference = agent.bindings?.[field];

    if (reference !== undefined) {
      addExactDeclaration(
        declarations,
        owner,
        field,
        childPointer(bindingsPointer, field),
        reference,
      );
    }
  }

  for (const variableId of Object.keys(agent.bindings?.variableProviders ?? {}).sort(
    compareExactStrings,
  )) {
    const reference = agent.bindings?.variableProviders?.[variableId];

    if (reference !== undefined) {
      addExactDeclaration(
        declarations,
        owner,
        'variableProvider',
        childPointer(childPointer(bindingsPointer, 'variableProviders'), variableId),
        reference,
      );
    }
  }

  addAffectedByDeclarations(
    declarations,
    agent.affectedBy,
    owner,
    childPointer(pointer, 'affectedBy'),
  );

  for (const capabilityId of Object.keys(agent.tools ?? {}).sort(compareExactStrings)) {
    const tool = agent.tools?.[capabilityId];

    if (tool !== undefined) {
      addCapabilityDeclarations(
        declarations,
        capabilityId,
        { kind: 'tool', value: tool },
        agentId,
        childPointer(childPointer(pointer, 'tools'), capabilityId),
      );
    }
  }

  for (const capabilityId of Object.keys(agent.skills ?? {}).sort(compareExactStrings)) {
    const skill = agent.skills?.[capabilityId];

    if (skill !== undefined) {
      addCapabilityDeclarations(
        declarations,
        capabilityId,
        { kind: 'skill', value: skill },
        agentId,
        childPointer(childPointer(pointer, 'skills'), capabilityId),
      );
    }
  }

  for (const [index, mirror] of (agent.mirrors ?? []).entries()) {
    addExactDeclaration(
      declarations,
      owner,
      'mirrors',
      childPointer(childPointer(pointer, 'mirrors'), String(index)),
      mirror,
    );
  }

  addUnresolvedDeclarations(
    declarations,
    agent.unresolved,
    childPointer(pointer, 'unresolved'),
    agentId,
  );
};

/** Collects every version 1 declaration that can establish changed-path relevance. */
const collectDeclarations = (
  manifest: IMoldeaManifestV1,
): readonly IManifestScopeRelationshipDeclaration[] => {
  const declarations: IManifestScopeRelationshipDeclaration[] = [];

  for (const kind of ['context', 'decision'] as const) {
    const relationships = kind === 'context' ? manifest.context : manifest.decisions;

    for (const ownerId of Object.keys(relationships ?? {}).sort(compareExactStrings)) {
      const relationship = relationships?.[ownerId];

      if (relationship === undefined) {
        continue;
      }

      const owner = createOwner(kind, ownerId);
      const pointer = childPointer(kind === 'context' ? '/context' : '/decisions', ownerId);
      addReferenceDeclarations(
        declarations,
        relationship.bindings,
        owner,
        'bindings',
        childPointer(pointer, 'bindings'),
      );
      addAffectedByDeclarations(
        declarations,
        relationship.affectedBy,
        owner,
        childPointer(pointer, 'affectedBy'),
      );
    }
  }

  addUnresolvedDeclarations(declarations, manifest.unresolved, '/unresolved', null);

  for (const agentId of Object.keys(manifest.agents ?? {}).sort(compareExactStrings)) {
    const agent = manifest.agents?.[agentId];

    if (agent !== undefined) {
      addAgentDeclarations(declarations, agentId, agent);
    }
  }

  return declarations.sort(compareDeclarations);
};

/** Tests a single-segment wildcard without regular-expression interpretation. */
const matchesSegment = (pattern: string, value: string): boolean => {
  let patternIndex = 0;
  let valueIndex = 0;
  let starIndex = -1;
  let starValueIndex = -1;

  while (valueIndex < value.length) {
    if (pattern[patternIndex] === value[valueIndex]) {
      patternIndex += 1;
      valueIndex += 1;
      continue;
    }

    if (pattern[patternIndex] === '*') {
      starIndex = patternIndex;
      starValueIndex = valueIndex;
      patternIndex += 1;
      continue;
    }

    if (starIndex === -1) {
      return false;
    }

    patternIndex = starIndex + 1;
    starValueIndex += 1;
    valueIndex = starValueIndex;
  }

  while (pattern[patternIndex] === '*') {
    patternIndex += 1;
  }

  return patternIndex === pattern.length;
};

/** Matches validated simple-glob segments with zero-or-more-segment globstars. */
const matchesGlob = (patternSegments: readonly string[], path: IRepositoryPath): boolean => {
  const pathSegments = path.slice(1).split('/');
  let reachable = new Uint8Array(pathSegments.length + 1);
  reachable[0] = 1;

  for (const patternSegment of patternSegments) {
    const next = new Uint8Array(pathSegments.length + 1);

    if (patternSegment === '**') {
      let canReach = false;

      for (let index = 0; index < reachable.length; index += 1) {
        canReach ||= reachable[index] === 1;
        next[index] = canReach ? 1 : 0;
      }
    } else {
      for (let index = 0; index < pathSegments.length; index += 1) {
        if (reachable[index] === 1 && matchesSegment(patternSegment, pathSegments[index] ?? '')) {
          next[index + 1] = 1;
        }
      }
    }

    reachable = next;
  }

  return reachable[pathSegments.length] === 1;
};

/** Builds exact and first-segment glob indexes once for one parsed manifest. */
const compileManifestScope = (
  manifest: IMoldeaManifestV1,
  limits: ICoreResourceLimits,
): ICompiledManifestScope => {
  const declarations = collectDeclarations(manifest);

  if (declarations.length > limits.maxEntries) {
    throw new CoreOperationException({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      limit: 'maxEntries',
      operation: 'match-manifest-scope',
    });
  }

  const exact = new Map<IRepositoryPath, IManifestScopeRelationshipDeclaration[]>();
  const globalGlobs: ICompiledGlobDeclaration[] = [];
  const globsByFirstSegment = new Map<string, ICompiledGlobDeclaration[]>();

  for (const declaration of declarations) {
    if (declaration.declaration.kind === 'exact') {
      const existing = exact.get(declaration.declaration.path) ?? [];
      existing.push(declaration);
      exact.set(declaration.declaration.path, existing);
      continue;
    }

    const segments = declaration.declaration.pattern.slice(1).split('/');
    const compiled = { declaration, segments };
    const firstSegment = segments[0] ?? '';

    if (firstSegment === '**' || firstSegment.includes('*')) {
      globalGlobs.push(compiled);
    } else {
      const existing = globsByFirstSegment.get(firstSegment) ?? [];
      existing.push(compiled);
      globsByFirstSegment.set(firstSegment, existing);
    }
  }

  return { declarations, exact, globalGlobs, globsByFirstSegment };
};

const compareMatches = (left: IManifestScopeMatch, right: IManifestScopeMatch): number => {
  return (
    compareOwners(left.owner, right.owner) ||
    compareExactStrings(left.field, right.field) ||
    compareExactStrings(
      getDeclarationValue(left.declaration),
      getDeclarationValue(right.declaration),
    ) ||
    compareExactStrings(left.inputPath, right.inputPath) ||
    compareExactStrings(left.pointer, right.pointer)
  );
};

const createMatch = (
  inputPath: IRepositoryPath,
  relationship: IManifestScopeRelationshipDeclaration,
): IManifestScopeMatch => ({
  declaration: relationship.declaration,
  field: relationship.field,
  inputPath,
  owner: relationship.owner,
  pointer: relationship.pointer,
});

/** Adds one match without ever allocating beyond the operation entry budget. */
const addMatch = (
  matches: IManifestScopeMatch[],
  inputPath: IRepositoryPath,
  relationship: IManifestScopeRelationshipDeclaration,
  limits: ICoreResourceLimits,
): void => {
  if (matches.length >= limits.maxEntries) {
    throw new CoreOperationException({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      limit: 'maxEntries',
      operation: 'match-manifest-scope',
    });
  }

  matches.push(createMatch(inputPath, relationship));
};

/** Appends matches from one precompiled glob bucket without copying the bucket. */
const addGlobMatches = (
  matches: IManifestScopeMatch[],
  inputPath: IRepositoryPath,
  declarations: readonly ICompiledGlobDeclaration[],
  limits: ICoreResourceLimits,
): void => {
  for (const compiled of declarations) {
    if (matchesGlob(compiled.segments, inputPath)) {
      addMatch(matches, inputPath, compiled.declaration, limits);
    }
  }
};

/** Creates the canonical digest of the sorted unique changed-path set. */
export const calculateManifestScopeInputDigest = async (
  paths: readonly IRepositoryPath[],
): Promise<IContentDigest> => {
  const value = paths.join('\0');

  return calculateNormalizedTextDigest({
    scalarLength: countUnicodeScalars(value),
    utf8ByteLength: measureUtf8ByteLength(value),
    value,
  });
};

/**
 * Matches normalized changed paths against one valid version 1 manifest.
 * @param manifest The parsed and validated manifest value.
 * @param paths Sorted unique repository-logical changed paths.
 * @param limits The immutable Core operation limits.
 * @returns Frozen content-free matches and stable aggregate counts.
 * @throws
 * - RESOURCE_LIMIT_EXCEEDED: The declaration or match count exceeded `maxEntries`.
 */
export const matchParsedManifestScope = (
  manifest: IMoldeaManifestV1,
  paths: readonly IRepositoryPath[],
  limits: ICoreResourceLimits,
): { readonly counts: IManifestScopeCounts; readonly matches: readonly IManifestScopeMatch[] } => {
  const compiled = compileManifestScope(manifest, limits);
  const matches: IManifestScopeMatch[] = [];
  const matchedOwners = new Set<string>();
  const matchedPaths = new Set<IRepositoryPath>();

  for (const path of paths) {
    const firstSegment = path.slice(1).split('/', 1)[0] ?? '';
    const exactDeclarations = compiled.exact.get(path) ?? [];

    for (const relationship of exactDeclarations) {
      addMatch(matches, path, relationship, limits);
    }

    addGlobMatches(matches, path, compiled.globalGlobs, limits);
    addGlobMatches(matches, path, compiled.globsByFirstSegment.get(firstSegment) ?? [], limits);
  }

  matches.sort(compareMatches);

  for (const match of matches) {
    matchedOwners.add(`${match.owner.kind}\0${match.owner.agentId ?? ''}\0${match.owner.id}`);
    matchedPaths.add(match.inputPath);
  }

  return freezeRecursively({
    counts: {
      declarations: compiled.declarations.length,
      inputPaths: paths.length,
      matchedOwners: matchedOwners.size,
      matchedPaths: matchedPaths.size,
      matches: matches.length,
    },
    matches,
  });
};
