import { posix } from 'node:path';
import ts from 'typescript';

import type { IRuntimeAdapterEvidence } from '@moldea.ai/core';
import type { IAdapterDiagnostic, IRuntimeAdapterContext } from '@moldea.ai/core/adapter';
import { parseRepositoryPath, type IRepositoryPath } from '@moldea.ai/repository';

import {
  EVE_ADAPTER_ID,
  EVE_DEFAULT_TOOLS_BOUNDARY_VERSION,
  EVE_REMOVED_DEFAULT_TOOL_NAMES,
  EVE_ROOT_COPY_TOOL_NAME,
  EVE_SUBAGENT_MODEL_VISIBILITY_BOUNDARY_VERSION,
  EVE_STABLE_DEFAULT_TOOL_NAMES,
  EVE_TASK_CANCEL_TOOL_NAME,
  EVE_TASK_CANCEL_BOUNDARY_VERSION,
  EVE_TEST_EXCLUSION_BOUNDARY_VERSION,
  EVE_TOOL_NAME_PATTERN,
  EVE_WORKSPACE_AGENT_BOUNDARY_VERSION,
} from '../constants/index.js';
import type {
  IEveAgentDefinition,
  IEveInspectionSession,
  IEveSubagentCandidate,
  IEveWorkspaceSubagentRegistration,
} from '../contracts/index.js';
import {
  getEveDefinition,
  getEvePropertyExpression,
  resolveEveStaticString,
} from '../source-analysis/index.js';
import { inspectEveAgent } from './agent-inspection.js';
import {
  addEveDiagnostic,
  addEveSourceFailureDiagnostic,
  addEveWarning,
  compareEveStrings,
  createEveEvidence,
} from './common.js';

const WORKSPACE_AGENT_KEYS = new Set(['description', 'name', 'tool']);

type INameState =
  | { readonly kind: 'free' }
  | { readonly kind: 'collision' }
  | { readonly kind: 'dynamic' }
  | { readonly boundaryVersion: string; readonly kind: 'version' };

const classifyEveSubagentName = (
  parent: IEveAgentDefinition,
  runtimeName: string,
  preparedTools: ReadonlySet<string>,
  authoredTools: ReadonlySet<string>,
): INameState => {
  if (runtimeName === EVE_ROOT_COPY_TOOL_NAME || preparedTools.has(runtimeName)) {
    return { kind: 'collision' };
  }

  if (authoredTools.has(runtimeName)) {
    return { kind: 'dynamic' };
  }

  const isStableDefault = EVE_STABLE_DEFAULT_TOOL_NAMES.includes(
    runtimeName as (typeof EVE_STABLE_DEFAULT_TOOL_NAMES)[number],
  );
  const isRemovedDefault = EVE_REMOVED_DEFAULT_TOOL_NAMES.includes(
    runtimeName as (typeof EVE_REMOVED_DEFAULT_TOOL_NAMES)[number],
  );
  const isTaskCancel = runtimeName === EVE_TASK_CANCEL_TOOL_NAME;

  if (!isStableDefault && !isRemovedDefault && !isTaskCancel) {
    return { kind: 'free' };
  }

  if (parent.defaultTools === null) {
    return { kind: 'dynamic' };
  }

  if (!parent.defaultTools) {
    return { kind: 'free' };
  }

  if (isStableDefault) {
    return { kind: 'collision' };
  }

  if (isRemovedDefault) {
    return parent.inspectedPackage.defaultToolBehavior === 'before'
      ? { kind: 'collision' }
      : parent.inspectedPackage.defaultToolBehavior === 'after'
        ? { kind: 'free' }
        : { boundaryVersion: EVE_DEFAULT_TOOLS_BOUNDARY_VERSION, kind: 'version' };
  }

  return parent.inspectedPackage.taskCancelBehavior === 'after'
    ? { kind: 'collision' }
    : parent.inspectedPackage.taskCancelBehavior === 'before'
      ? { kind: 'free' }
      : { boundaryVersion: EVE_TASK_CANCEL_BOUNDARY_VERSION, kind: 'version' };
};

const reportEveSubagentNameIssue = (
  parent: IEveAgentDefinition,
  path: IRepositoryPath,
  agentId: string,
  state: INameState,
  diagnostics: IAdapterDiagnostic[],
): boolean => {
  if (state.kind === 'free') {
    return false;
  }

  if (state.kind === 'collision') {
    addEveDiagnostic(
      diagnostics,
      'EVE_TOOL_SUBAGENT_NAME_COLLISION',
      path,
      agentId,
      null,
      undefined,
      undefined,
      { collisionKind: 'runtime-tool' },
    );
    return true;
  }

  addEveWarning(
    diagnostics,
    path,
    agentId,
    state.kind === 'dynamic'
      ? { reason: 'dynamic-source-pattern', relationship: 'handoff-registration' }
      : {
          boundaryVersion: state.boundaryVersion,
          declaredRange: parent.inspectedPackage.declaredRange,
          packageName: 'eve',
          reason: 'version-dependent-behavior',
          relationship: 'handoff-registration',
        },
  );
  return true;
};

/** Resolves a direct workspace declaration only through its exact registered peer path. */
export const resolveEveWorkspaceSubagent = async (
  session: IEveInspectionSession,
  context: IRuntimeAdapterContext,
  parent: IEveAgentDefinition,
  candidate: IEveSubagentCandidate,
  diagnostics: IAdapterDiagnostic[],
): Promise<IEveWorkspaceSubagentRegistration | null> => {
  if (
    parent.root.layout !== 'workspace' ||
    candidate.kind !== 'file' ||
    !candidate.isSupportedSource ||
    candidate.isCollidedSlot ||
    candidate.isExtensionReserved
  ) {
    return null;
  }

  if (candidate.isTestSource && parent.inspectedPackage.testExclusionBehavior === 'after') {
    return null;
  }

  const source = await session.analyzeSource(candidate.agentPath);

  if (
    addEveSourceFailureDiagnostic(diagnostics, source, candidate.agentPath, parent.agent.id) ||
    source.kind !== 'valid'
  ) {
    return null;
  }

  const declaration = getEveDefinition(source.analysis, 'workspace-agent');

  if (declaration.kind !== 'present-supported') {
    return null;
  }

  if (parent.inspectedPackage.workspaceAgentBehavior === 'before') {
    addEveDiagnostic(
      diagnostics,
      'EVE_SDK_FEATURE_UNAVAILABLE',
      candidate.agentPath,
      parent.agent.id,
      null,
      undefined,
      undefined,
      { feature: 'workspace-agent' },
    );
    return null;
  }

  if (parent.inspectedPackage.workspaceAgentBehavior === null) {
    addEveWarning(diagnostics, candidate.agentPath, parent.agent.id, {
      boundaryVersion: EVE_WORKSPACE_AGENT_BOUNDARY_VERSION,
      declaredRange: parent.inspectedPackage.declaredRange,
      packageName: 'eve',
      reason: 'version-dependent-behavior',
      relationship: 'handoff-registration',
    });
    return null;
  }

  if (declaration.properties.has('tool')) {
    if (parent.inspectedPackage.subagentModelVisibilityBehavior === 'before') {
      addEveDiagnostic(
        diagnostics,
        'EVE_SDK_FEATURE_UNAVAILABLE',
        candidate.agentPath,
        parent.agent.id,
        null,
        undefined,
        undefined,
        { feature: 'subagent-model-visibility' },
      );
      return null;
    }

    if (parent.inspectedPackage.subagentModelVisibilityBehavior === null) {
      addEveWarning(diagnostics, candidate.agentPath, parent.agent.id, {
        boundaryVersion: EVE_SUBAGENT_MODEL_VISIBILITY_BOUNDARY_VERSION,
        declaredRange: parent.inspectedPackage.declaredRange,
        packageName: 'eve',
        reason: 'version-dependent-behavior',
        relationship: 'handoff-registration',
      });
      return null;
    }
  }

  if (
    [...declaration.properties].some(
      ([key, property]) => !WORKSPACE_AGENT_KEYS.has(key) || !ts.isPropertyAssignment(property),
    )
  ) {
    addEveWarning(diagnostics, candidate.agentPath, parent.agent.id, {
      reason: 'dynamic-source-pattern',
      relationship: 'handoff-registration',
    });
    return null;
  }

  const nameExpression = getEvePropertyExpression(declaration.properties, 'name');
  const name =
    nameExpression === null
      ? null
      : await resolveEveStaticString(session, source.analysis, nameExpression);

  if (name?.kind !== 'supported' || !EVE_TOOL_NAME_PATTERN.test(name.value)) {
    return null;
  }

  const descriptionExpression = getEvePropertyExpression(declaration.properties, 'description');
  const description =
    descriptionExpression === null
      ? null
      : await resolveEveStaticString(session, source.analysis, descriptionExpression);
  const toolExpression = getEvePropertyExpression(declaration.properties, 'tool');
  const isModelVisible =
    toolExpression === null
      ? true
      : toolExpression.kind === ts.SyntaxKind.TrueKeyword
        ? true
        : toolExpression.kind === ts.SyntaxKind.FalseKeyword
          ? false
          : null;

  if ((description !== null && description.kind !== 'supported') || isModelVisible === null) {
    addEveWarning(diagnostics, candidate.agentPath, parent.agent.id, {
      reason: 'dynamic-source-pattern',
      relationship: 'handoff-registration',
    });
    return null;
  }

  if (candidate.isTestSource && parent.inspectedPackage.testExclusionBehavior !== 'before') {
    if (parent.inspectedPackage.testExclusionBehavior === null) {
      addEveWarning(diagnostics, candidate.agentPath, parent.agent.id, {
        boundaryVersion: EVE_TEST_EXCLUSION_BOUNDARY_VERSION,
        declaredRange: parent.inspectedPackage.declaredRange,
        packageName: 'eve',
        reason: 'version-dependent-behavior',
        relationship: 'handoff-registration',
      });
    }
    return null;
  }

  const agentsRoot = posix.dirname(posix.dirname(parent.root.agentRoot));
  const targetPath = parseRepositoryPath(posix.join(agentsRoot, name.value, 'agent', 'agent.ts'));
  const resolution = context.resolveAgent({ path: targetPath, symbol: 'default' });

  if (resolution.kind !== 'matched' || resolution.agent.id === parent.agent.id) {
    return null;
  }

  const target = await inspectEveAgent(session, resolution.agent, [], []);

  return target?.root.layout === 'workspace' && target.root.runtimeName === name.value
    ? Object.freeze({
        candidate,
        descriptionOverride: description?.kind === 'supported' ? description.value : null,
        isModelVisible,
        parent,
        target,
      })
    : null;
};

/** Inspects exact immediate directory-backed local-subagent registrations. */
export const inspectEveSubagents = (
  definitions: readonly IEveAgentDefinition[],
  workspaceRegistrations: readonly IEveWorkspaceSubagentRegistration[],
  preparedToolNames: ReadonlyMap<string, ReadonlySet<string>>,
  ambiguousParentRoots: ReadonlyMap<IRepositoryPath, number>,
  evidence: IRuntimeAdapterEvidence[],
  diagnostics: IAdapterDiagnostic[],
): void => {
  const definitionsByRoot = new Map<IRepositoryPath, IEveAgentDefinition[]>();
  const candidatesByRoot = new Map<
    IRepositoryPath,
    ReadonlyMap<string, readonly IEveSubagentCandidate[]>
  >();
  const authoredToolNames = new Map<string, ReadonlySet<string>>();

  for (const definition of definitions) {
    const group = definitionsByRoot.get(definition.root.agentRoot) ?? [];
    group.push(definition);
    definitionsByRoot.set(definition.root.agentRoot, group);

    const candidates = new Map<string, IEveSubagentCandidate[]>();

    for (const candidate of definition.rootIndex.subagentCandidates) {
      const named = candidates.get(candidate.runtimeName) ?? [];
      named.push(candidate);
      candidates.set(candidate.runtimeName, named);
    }

    candidatesByRoot.set(definition.root.agentRoot, candidates);
    authoredToolNames.set(
      definition.agent.id,
      new Set(
        definition.rootIndex.toolCandidates
          .filter(
            ({ isTestSource }) =>
              !isTestSource || definition.inspectedPackage.testExclusionBehavior !== 'after',
          )
          .map(({ runtimeName }) => runtimeName),
      ),
    );
  }

  for (const target of definitions) {
    if (
      target.root.agentKind !== 'local-subagent' ||
      target.root.parentRoot === null ||
      target.root.runtimeName === null
    ) {
      continue;
    }

    const ambiguousParentCount = ambiguousParentRoots.get(target.root.parentRoot);

    if (ambiguousParentCount !== undefined) {
      addEveDiagnostic(
        diagnostics,
        'EVE_SUBAGENT_PARENT_AMBIGUOUS',
        target.agent.declaration.bindings?.runtimeAgent?.path ?? null,
        target.agent.id,
        null,
        undefined,
        undefined,
        { candidateCount: ambiguousParentCount },
      );
      continue;
    }

    const parents =
      definitionsByRoot
        .get(target.root.parentRoot)
        ?.sort((left, right) => compareEveStrings(left.agent.id, right.agent.id)) ?? [];

    if (parents.length > 1) {
      addEveDiagnostic(
        diagnostics,
        'EVE_SUBAGENT_PARENT_AMBIGUOUS',
        target.agent.declaration.bindings?.runtimeAgent?.path ?? null,
        target.agent.id,
        null,
        undefined,
        undefined,
        { candidateCount: parents.length },
      );
      continue;
    }

    const parent = parents[0];

    if (parent === undefined) {
      continue;
    }

    const candidates =
      candidatesByRoot.get(parent.root.agentRoot)?.get(target.root.runtimeName) ?? [];
    const candidate = candidates.find(
      ({ agentPath, isCollidedSlot, isSupportedSource, kind }) =>
        kind === 'directory' &&
        isSupportedSource &&
        !isCollidedSlot &&
        agentPath === target.agent.declaration.bindings?.runtimeAgent?.path,
    );

    if (candidates.length !== 1 || candidate === undefined || candidate.isExtensionReserved) {
      continue;
    }

    if (target.isModelVisible === false) {
      continue;
    }

    if (target.isModelVisible === null) {
      addEveWarning(diagnostics, candidate.agentPath, target.agent.id, {
        reason: 'dynamic-source-pattern',
        relationship: 'handoff-registration',
      });
      continue;
    }

    if (
      reportEveSubagentNameIssue(
        parent,
        candidate.agentPath,
        target.agent.id,
        classifyEveSubagentName(
          parent,
          target.root.runtimeName,
          preparedToolNames.get(parent.agent.id) ?? new Set<string>(),
          authoredToolNames.get(parent.agent.id) ?? new Set<string>(),
        ),
        diagnostics,
      )
    ) {
      continue;
    }

    if (
      target.routingDescription.kind === 'absent' ||
      (target.routingDescription.kind === 'supported' && target.routingDescription.value === '')
    ) {
      addEveDiagnostic(
        diagnostics,
        'EVE_ROUTING_DESCRIPTION_MISSING',
        target.agent.declaration.bindings?.runtimeAgent?.path ?? null,
        target.agent.id,
        target.routingDescription.range,
      );
      continue;
    }

    if (target.routingDescription.kind !== 'supported') {
      continue;
    }

    const routingDescriptionSource =
      target.agent.handoffDescription === null ? 'agent-description' : 'handoff-description';
    const effectiveDescription =
      target.agent.handoffDescription?.value ?? target.agent.description.value;
    const isWired = target.routingDescription.value === effectiveDescription;

    if (!isWired) {
      addEveDiagnostic(
        diagnostics,
        'EVE_ROUTING_DESCRIPTION_NOT_WIRED',
        target.agent.declaration.bindings?.runtimeAgent?.path ?? null,
        target.agent.id,
        target.routingDescription.range,
      );
    }

    const parentReference = parent.agent.declaration.bindings?.runtimeAgent;
    const targetReference = target.agent.declaration.bindings?.runtimeAgent;

    if (parentReference === undefined || targetReference === undefined) {
      continue;
    }

    evidence.push(
      createEveEvidence({
        agentId: parent.agent.id,
        capabilityId: null,
        capabilityKind: null,
        details: {
          registrationKind: 'local-subagent-package',
          routingDescriptionSource,
          routingDescriptionWired: isWired,
          targetAgentId: target.agent.id,
          targetRuntimeName: target.root.runtimeName,
        },
        kind: 'handoff-registration',
        references: [parentReference, targetReference],
        runtimeName: target.root.runtimeName,
        source: EVE_ADAPTER_ID,
      }),
    );
  }

  for (const registration of workspaceRegistrations) {
    const { candidate, descriptionOverride, isModelVisible, parent, target } = registration;

    if (!isModelVisible) {
      continue;
    }

    if (
      reportEveSubagentNameIssue(
        parent,
        candidate.agentPath,
        parent.agent.id,
        classifyEveSubagentName(
          parent,
          candidate.runtimeName,
          preparedToolNames.get(parent.agent.id) ?? new Set<string>(),
          authoredToolNames.get(parent.agent.id) ?? new Set<string>(),
        ),
        diagnostics,
      )
    ) {
      continue;
    }

    const routingDescription =
      descriptionOverride !== null && descriptionOverride.trim().length > 0
        ? descriptionOverride
        : target.routingDescription.kind === 'supported'
          ? target.routingDescription.value
          : null;

    if (routingDescription === null) {
      if (target.routingDescription.kind === 'absent' && descriptionOverride === null) {
        addEveDiagnostic(
          diagnostics,
          'EVE_ROUTING_DESCRIPTION_MISSING',
          candidate.agentPath,
          parent.agent.id,
        );
      } else {
        addEveWarning(diagnostics, candidate.agentPath, parent.agent.id, {
          reason: 'dynamic-source-pattern',
          relationship: 'handoff-registration',
        });
      }
      continue;
    }

    if (routingDescription.trim().length === 0) {
      addEveDiagnostic(
        diagnostics,
        'EVE_ROUTING_DESCRIPTION_MISSING',
        candidate.agentPath,
        parent.agent.id,
      );
      continue;
    }

    const canonicalDescription =
      target.agent.handoffDescription?.value ?? target.agent.description.value;
    const isWired = routingDescription === canonicalDescription;

    if (!isWired) {
      addEveDiagnostic(
        diagnostics,
        'EVE_ROUTING_DESCRIPTION_NOT_WIRED',
        candidate.agentPath,
        parent.agent.id,
      );
    }

    const parentReference = parent.agent.declaration.bindings?.runtimeAgent;
    const targetReference = target.agent.declaration.bindings?.runtimeAgent;

    if (parentReference === undefined || targetReference === undefined) {
      continue;
    }

    evidence.push(
      createEveEvidence({
        agentId: parent.agent.id,
        capabilityId: null,
        capabilityKind: null,
        details: {
          registrationKind: 'workspace-subagent',
          routingDescriptionSource:
            descriptionOverride !== null && descriptionOverride.trim().length > 0
              ? 'workspace-description'
              : 'agent-description',
          routingDescriptionWired: isWired,
          targetAgentId: target.agent.id,
          targetRuntimeName: target.root.runtimeName,
        },
        kind: 'handoff-registration',
        references: [parentReference, { path: candidate.agentPath }, targetReference],
        runtimeName: candidate.runtimeName,
        source: EVE_ADAPTER_ID,
      }),
    );
  }
};
