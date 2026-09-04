import type {
  IDiagnostic,
  IIndexedTextAsset,
  IProjectInspectionResult,
  IRuntimeAdapterEvidence,
} from '@moldea.ai/core';
import type {
  IAgentManifestEntry,
  IRepositoryReference,
  IRelationshipManifestEntry,
  IUnresolvedRequirementManifestEntry,
} from '@moldea.ai/core/format';

import { calculateMoldeaCliJsonDigest } from '../output-page/index.js';
import type { IJsonValue } from '../json-serialization/index.js';

import { MOLDEA_CLI_GIT_WORKING_TREE_SOURCE } from './constants.js';
import type {
  IMoldeaCliAssetMetadata,
  IMoldeaCliDiagnosticRecord,
  IMoldeaCliEvidenceReferenceRecord,
  IMoldeaCliEvidenceRecord,
  IMoldeaCliInspectProjection,
  IMoldeaCliInspectRecord,
  IMoldeaCliRelationshipRecord,
  IMoldeaCliRequirementRecord,
  IMoldeaCliUnresolvedRecord,
  IMoldeaCliValidateProjection,
} from './types.js';

/** Rejects a Core result whose completion fields contradict its validity. */
const assertProjectInspectionInvariant = (inspection: IProjectInspectionResult): void => {
  const hasDiagnostics = inspection.diagnostics.length > 0;
  const hasProject = inspection.project !== null;
  const isConsistent = inspection.valid
    ? hasProject && !hasDiagnostics
    : !hasProject && hasDiagnostics;

  if (!isConsistent) {
    throw new TypeError('The Core inspection result is internally inconsistent.');
  }
};

/** Creates one stable composite key without exposing cursor internals. */
const createRecordKey = (kind: string, ...parts: readonly unknown[]): string =>
  JSON.stringify([kind, ...parts]);

/** Compares projected records by their complete stable composite keys. */
const compareRecordKeys = (
  left: IMoldeaCliInspectRecord,
  right: IMoldeaCliInspectRecord,
): number => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0);

/** Removes canonical text while retaining exact asset identity and size metadata. */
const createAssetMetadata = (asset: IIndexedTextAsset): IMoldeaCliAssetMetadata =>
  Object.freeze({
    digest: asset.digest,
    path: asset.path,
    scalarLength: asset.scalarLength,
    utf8ByteLength: asset.utf8ByteLength,
  });

/** Projects one diagnostic without retaining arbitrary detail payloads. */
export const createMoldeaCliDiagnosticRecord = (
  diagnostic: IDiagnostic,
  occurrence = 0,
): IMoldeaCliDiagnosticRecord =>
  Object.freeze({
    code: diagnostic.code,
    entity: diagnostic.entity,
    key: createRecordKey(
      'diagnostic',
      diagnostic.source,
      diagnostic.code,
      diagnostic.path,
      diagnostic.pointer,
      occurrence,
    ),
    kind: 'diagnostic',
    message: diagnostic.message,
    path: diagnostic.path,
    pointer: diagnostic.pointer,
    range: diagnostic.range,
    source: diagnostic.source,
  });

/** Projects one adapter evidence item through its bounded metadata allowlist. */
const createEvidenceRecords = (
  evidence: IRuntimeAdapterEvidence,
  occurrence: number,
): readonly (IMoldeaCliEvidenceRecord | IMoldeaCliEvidenceReferenceRecord)[] => {
  const evidenceKey = createRecordKey(
    'evidence',
    evidence.source,
    evidence.kind,
    evidence.agentId,
    evidence.capabilityKind,
    evidence.capabilityId,
    evidence.runtimeName,
    occurrence,
  );
  const summary: IMoldeaCliEvidenceRecord = Object.freeze({
    agentId: evidence.agentId,
    capabilityId: evidence.capabilityId,
    capabilityKind: evidence.capabilityKind,
    evidenceKind: evidence.kind,
    key: evidenceKey,
    kind: 'evidence',
    referenceCount: evidence.references.length,
    runtimeName: evidence.runtimeName,
    source: evidence.source,
  });

  return Object.freeze([
    summary,
    ...evidence.references.map((reference, index): IMoldeaCliEvidenceReferenceRecord =>
      Object.freeze({
        evidenceKey,
        key: createRecordKey(
          'evidence-reference',
          evidenceKey,
          reference.path,
          reference.symbol ?? null,
          index,
        ),
        kind: 'evidence-reference',
        path: reference.path,
        symbol: reference.symbol ?? null,
      }),
    ),
  ]);
};

/** Adds one exact or glob relationship record to the projection. */
const addRelationship = (
  records: IMoldeaCliRelationshipRecord[],
  ownerKind: IMoldeaCliRelationshipRecord['ownerKind'],
  ownerId: string,
  agentId: string | null,
  field: string,
  path: string,
  symbol: string | null = null,
): void => {
  const declarationKind = path.includes('*') ? 'glob' : 'exact';

  records.push(
    Object.freeze({
      agentId,
      declarationKind,
      field,
      key: createRecordKey(
        'relationship',
        ownerKind,
        agentId,
        ownerId,
        field,
        declarationKind,
        path,
        symbol,
      ),
      kind: 'relationship',
      ownerId,
      ownerKind,
      path,
      symbol,
    }),
  );
};

/** Adds reference-list and impact relationships from a context or decision owner. */
const addRelationshipEntry = (
  records: IMoldeaCliRelationshipRecord[],
  ownerKind: 'context' | 'decision',
  ownerId: string,
  relationship: IRelationshipManifestEntry | null,
): void => {
  for (const reference of relationship?.bindings ?? []) {
    addRelationship(
      records,
      ownerKind,
      ownerId,
      null,
      'bindings',
      reference.path,
      reference.symbol ?? null,
    );
  }

  for (const pattern of relationship?.affectedBy ?? []) {
    addRelationship(records, ownerKind, ownerId, null, 'affectedBy', pattern);
  }
};

/** Adds unresolved requirement metadata and its related-path relationships. */
const addUnresolved = (
  records: IMoldeaCliUnresolvedRecord[],
  relationships: IMoldeaCliRelationshipRecord[],
  unresolved: Readonly<Record<string, IUnresolvedRequirementManifestEntry>> | undefined,
  agentId: string | null,
): void => {
  for (const requirementId of Object.keys(unresolved ?? {}).sort()) {
    const requirement = unresolved?.[requirementId];

    if (requirement === undefined) {
      continue;
    }

    records.push(
      Object.freeze({
        agentId,
        category: requirement.category,
        effect: requirement.effect,
        key: createRecordKey('unresolved', agentId, requirementId),
        kind: 'unresolved',
        relatedCount: requirement.related?.length ?? 0,
        requirementId,
      }),
    );

    for (const reference of requirement.related ?? []) {
      addRelationship(
        relationships,
        'unresolved',
        requirementId,
        agentId,
        'related',
        reference.path,
        reference.symbol ?? null,
      );
    }
  }
};

/** Adds one capability requirement and its complete repository relationships. */
const addCapability = (
  requirements: IMoldeaCliRequirementRecord[],
  relationships: IMoldeaCliRelationshipRecord[],
  capabilityKind: 'skill' | 'tool',
  capabilityId: string,
  capability:
    | NonNullable<IAgentManifestEntry['skills']>[string]
    | NonNullable<IAgentManifestEntry['tools']>[string],
  agentId: string,
): void => {
  requirements.push(
    Object.freeze({
      agentId,
      capabilityId,
      capabilityKind,
      implementationPath: capability.implementation.path,
      implementationSymbol: capability.implementation.symbol ?? null,
      key: createRecordKey('requirement', agentId, capabilityKind, capabilityId),
      kind: 'requirement',
      name: capability.name,
      registrationPath: capability.registration?.path ?? null,
    }),
  );
  const ownerKind = capabilityKind;

  addRelationship(
    relationships,
    ownerKind,
    capabilityId,
    agentId,
    'implementation',
    capability.implementation.path,
    capability.implementation.symbol ?? null,
  );

  if (capability.registration !== undefined) {
    addRelationship(
      relationships,
      ownerKind,
      capabilityId,
      agentId,
      'registration',
      capability.registration.path,
      capability.registration.symbol ?? null,
    );
  }

  if (capabilityKind === 'tool') {
    const tool = capability as NonNullable<IAgentManifestEntry['tools']>[string];

    for (const field of ['inputSchema', 'outputSchema'] as const) {
      const reference = tool[field];

      if (reference !== undefined) {
        addRelationship(
          relationships,
          ownerKind,
          capabilityId,
          agentId,
          field,
          reference.path,
          reference.symbol ?? null,
        );
      }
    }
  }

  for (const pattern of capability.affectedBy ?? []) {
    addRelationship(relationships, ownerKind, capabilityId, agentId, 'affectedBy', pattern);
  }
};

/** Adds all repository relationships declared by one indexed agent. */
const addAgentRelationships = (
  relationships: IMoldeaCliRelationshipRecord[],
  requirements: IMoldeaCliRequirementRecord[],
  agentId: string,
  declaration: IAgentManifestEntry,
): void => {
  const ownerKind = 'agent';

  for (const field of [
    'runtimeAgent',
    'inputSchema',
    'outputSchema',
    'instructionLoader',
  ] as const) {
    const reference = declaration.bindings?.[field];

    if (reference !== undefined) {
      addRelationship(
        relationships,
        ownerKind,
        agentId,
        agentId,
        field,
        reference.path,
        reference.symbol ?? null,
      );
    }
  }

  for (const variableId of Object.keys(declaration.bindings?.variableProviders ?? {}).sort()) {
    const reference: IRepositoryReference | undefined =
      declaration.bindings?.variableProviders?.[variableId];

    if (reference !== undefined) {
      addRelationship(
        relationships,
        ownerKind,
        agentId,
        agentId,
        `variableProvider:${variableId}`,
        reference.path,
        reference.symbol ?? null,
      );
    }
  }

  for (const pattern of declaration.affectedBy ?? []) {
    addRelationship(relationships, ownerKind, agentId, agentId, 'affectedBy', pattern);
  }

  for (const capabilityId of Object.keys(declaration.tools ?? {}).sort()) {
    const capability = declaration.tools?.[capabilityId];

    if (capability !== undefined) {
      addCapability(requirements, relationships, 'tool', capabilityId, capability, agentId);
    }
  }

  for (const capabilityId of Object.keys(declaration.skills ?? {}).sort()) {
    const capability = declaration.skills?.[capabilityId];

    if (capability !== undefined) {
      addCapability(requirements, relationships, 'skill', capabilityId, capability, agentId);
    }
  }
};

/** Collects every canonical body used to assert that projections remain content-free. */
const collectCanonicalBodies = (inspection: IProjectInspectionResult): readonly string[] => {
  const project = inspection.project;

  if (project === null) {
    return Object.freeze([]);
  }

  return Object.freeze([
    project.manifest.asset.content,
    project.project.content,
    ...project.context.map(({ asset }) => asset.content),
    ...project.decisions.flatMap(({ decision }) => [decision.asset.content, decision.body]),
    ...project.runtimes.map(({ asset }) => asset.content),
    ...project.agents.flatMap(({ description, instruction, handoffDescription }) => [
      description.asset.content,
      description.value,
      instruction.content,
      ...(handoffDescription === null
        ? []
        : [handoffDescription.asset.content, handoffDescription.value]),
    ]),
  ]);
};

/** Creates content-free validation metadata and ordered diagnostic records. */
export const createMoldeaCliValidateProjection = (
  inspection: IProjectInspectionResult,
): IMoldeaCliValidateProjection => {
  assertProjectInspectionInvariant(inspection);
  const diagnostics = Object.freeze(
    inspection.diagnostics.map((diagnostic, index) =>
      createMoldeaCliDiagnosticRecord(diagnostic, index),
    ),
  );
  const snapshotDigest = calculateMoldeaCliJsonDigest({
    diagnostics,
    formatVersion: inspection.formatVersion,
  } as unknown as IJsonValue);

  return Object.freeze({
    canonicalBodies: collectCanonicalBodies(inspection),
    diagnostics,
    formatVersion: inspection.formatVersion,
    snapshotDigest,
    source: MOLDEA_CLI_GIT_WORKING_TREE_SOURCE,
  });
};

/**
 * Projects one complete Core inspection through the schema 3 metadata allowlist.
 * @param inspection The immutable Core inspection result.
 * @returns Ordered metadata records, aggregate counts, and canonical-body guard seeds.
 * @throws If the Core result contradicts its valid, project, and diagnostic invariants.
 */
export const createMoldeaCliInspectProjection = (
  inspection: IProjectInspectionResult,
): IMoldeaCliInspectProjection => {
  assertProjectInspectionInvariant(inspection);
  const project = inspection.project;
  const relationships: IMoldeaCliRelationshipRecord[] = [];
  const requirements: IMoldeaCliRequirementRecord[] = [];
  const unresolved: IMoldeaCliUnresolvedRecord[] = [];
  const records: IMoldeaCliInspectRecord[] = [
    ...inspection.diagnostics.map((diagnostic, index) =>
      createMoldeaCliDiagnosticRecord(diagnostic, index),
    ),
    ...inspection.evidence.flatMap(createEvidenceRecords),
  ];

  if (project !== null) {
    for (const context of project.context) {
      records.push(
        Object.freeze({
          asset: createAssetMetadata(context.asset),
          key: createRecordKey('context', context.asset.path),
          kind: 'context',
        }),
      );
      addRelationshipEntry(relationships, 'context', context.asset.path, context.relationships);
    }

    for (const indexedDecision of project.decisions) {
      const { decision } = indexedDecision;

      records.push(
        Object.freeze({
          asset: createAssetMetadata(decision.asset),
          createdAt: decision.createdAt,
          decisionId: decision.id,
          key: createRecordKey('decision', decision.id, decision.path),
          kind: 'decision',
          status: decision.status,
          supersedesCount: decision.supersedes.length,
        }),
      );

      for (const supersededDecisionId of decision.supersedes) {
        records.push(
          Object.freeze({
            decisionId: decision.id,
            key: createRecordKey('decision-supersession', decision.id, supersededDecisionId),
            kind: 'decision-supersession',
            supersededDecisionId,
          }),
        );
      }
      addRelationshipEntry(relationships, 'decision', decision.id, indexedDecision.relationships);
    }

    for (const runtime of project.runtimes) {
      records.push(
        Object.freeze({
          asset: createAssetMetadata(runtime.asset),
          key: createRecordKey('runtime', runtime.asset.path),
          kind: 'runtime',
        }),
      );
    }

    for (const agent of project.agents) {
      records.push(
        Object.freeze({
          agentId: agent.id,
          contextCount: agent.context.length,
          decisionCount: agent.decisions.length,
          description: createAssetMetadata(agent.description.asset),
          handoffDescription:
            agent.handoffDescription === null
              ? null
              : createAssetMetadata(agent.handoffDescription.asset),
          instruction: createAssetMetadata(agent.instruction),
          key: createRecordKey('agent', agent.id),
          kind: 'agent',
          runtimeId: agent.declaration.runtime.id,
        }),
      );
      for (const contextPath of agent.context) {
        addRelationship(relationships, 'agent', agent.id, agent.id, 'context', contextPath);
      }

      for (const decisionPath of agent.decisions) {
        addRelationship(relationships, 'agent', agent.id, agent.id, 'decisions', decisionPath);
      }
      addAgentRelationships(relationships, requirements, agent.id, agent.declaration);

      for (const mirror of agent.mirrors) {
        records.push(
          Object.freeze({
            agentId: agent.id,
            canonicalDigest: mirror.canonicalDigest,
            digest: mirror.digest,
            key: createRecordKey('mirror', agent.id, mirror.path),
            kind: 'mirror',
            path: mirror.path,
          }),
        );
      }

      addUnresolved(unresolved, relationships, agent.declaration.unresolved, agent.id);
    }

    addUnresolved(unresolved, relationships, project.unresolved, null);
    records.push(...relationships, ...requirements, ...unresolved);
  }

  records.sort(compareRecordKeys);
  const counts = Object.freeze({
    agents: records.filter(({ kind }) => kind === 'agent').length,
    context: records.filter(({ kind }) => kind === 'context').length,
    decisions: records.filter(({ kind }) => kind === 'decision').length,
    decisionSupersessions: records.filter(({ kind }) => kind === 'decision-supersession').length,
    diagnostics: records.filter(({ kind }) => kind === 'diagnostic').length,
    evidence: records.filter(({ kind }) => kind === 'evidence').length,
    evidenceReferences: records.filter(({ kind }) => kind === 'evidence-reference').length,
    mirrors: records.filter(({ kind }) => kind === 'mirror').length,
    relationships: relationships.length,
    requirements: requirements.length,
    runtimes: records.filter(({ kind }) => kind === 'runtime').length,
    unresolved: unresolved.length,
  });
  const projectMetadata =
    project === null
      ? null
      : Object.freeze({
          manifest: createAssetMetadata(project.manifest.asset),
          project: createAssetMetadata(project.project),
        });
  const snapshotDigest = calculateMoldeaCliJsonDigest({
    counts,
    formatVersion: inspection.formatVersion,
    project: projectMetadata,
    records,
  } as unknown as IJsonValue);

  return Object.freeze({
    canonicalBodies: collectCanonicalBodies(inspection),
    counts,
    formatVersion: inspection.formatVersion,
    project: projectMetadata,
    records: Object.freeze(records),
    snapshotDigest,
    source: MOLDEA_CLI_GIT_WORKING_TREE_SOURCE,
  });
};
