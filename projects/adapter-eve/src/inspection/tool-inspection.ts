import ts from 'typescript';

import type { IRuntimeAdapterEvidence } from '@moldea.ai/core';
import type { IAdapterDiagnostic } from '@moldea.ai/core/adapter';
import type { IToolManifestEntry } from '@moldea.ai/core/format';

import {
  EVE_ADAPTER_ID,
  EVE_RESERVED_TOOL_NAME,
  EVE_SUBAGENT_TOOL_EXPOSURE_BOUNDARY_VERSION,
  EVE_TEST_EXCLUSION_BOUNDARY_VERSION,
  EVE_TOOL_NAME_PATTERN,
  EVE_WORKFLOW_TOOL_BOUNDARY_VERSION,
} from '../constants/index.js';
import type {
  IEveAgentDefinition,
  IEveDefinitionResult,
  IEveInspectionSession,
  IEveSourceAnalysis,
  IEveToolCandidate,
} from '../contracts/index.js';
import {
  classifyEveWorkflowExecutor,
  getEveDefinition,
  getEveObjectMembers,
  getEvePropertyExpression,
  isEveResolvedFunctionValue,
  resolveEveStaticString,
} from '../source-analysis/index.js';
import {
  addEveDiagnostic,
  addEveSourceFailureDiagnostic,
  addEveWarning,
  compareEveStrings,
  createEveEvidence,
} from './common.js';
import { classifyEveBoundExpression } from './relationships.js';

interface IPreparedTool {
  readonly analysis: IEveSourceAnalysis;
  readonly availability: 'absent' | 'enabled' | 'disabled' | 'unknown';
  readonly candidate: IEveToolCandidate;
  readonly definition: Extract<IEveDefinitionResult, { readonly kind: 'present-supported' }>;
  readonly execution: 'background' | 'foreground' | 'unknown';
  readonly helperKind: 'tool' | 'workflow-tool';
  readonly isRegistrationEligible: boolean;
  readonly workflowExecutor: 'valid' | 'invalid' | 'unknown' | null;
}

const ALLOWED_TOOL_KEYS = new Set([
  'availableInSubagents',
  'approval',
  'description',
  'execute',
  'inputSchema',
  'outputSchema',
  'toModelOutput',
]);
const TOOL_PREPARATION_BATCH_SIZE = 8;

const isApprovalSupported = async (
  session: IEveInspectionSession,
  analysis: IEveSourceAnalysis,
  property: ts.ObjectLiteralElementLike | undefined,
): Promise<boolean> => {
  if (property === undefined) {
    return true;
  }

  if (!ts.isPropertyAssignment(property)) {
    return false;
  }

  if (await isEveResolvedFunctionValue(session, analysis, property.initializer)) {
    return true;
  }

  const expression = property.initializer;

  if (!ts.isObjectLiteralExpression(expression)) {
    return false;
  }

  const members = getEveObjectMembers(expression);

  if (
    members === null ||
    !members.has('request') ||
    [...members.keys()].some((key) => !['request', 'response'].includes(key))
  ) {
    return false;
  }

  for (const [name, member] of members) {
    if (
      !ts.isMethodDeclaration(member) &&
      (!ts.isPropertyAssignment(member) ||
        !(await isEveResolvedFunctionValue(session, analysis, member.initializer)))
    ) {
      return false;
    }

    if (!['request', 'response'].includes(name)) {
      return false;
    }
  }

  return true;
};

const prepareTool = async (
  session: IEveInspectionSession,
  candidate: IEveToolCandidate,
): Promise<IPreparedTool | null> => {
  if (!candidate.isSupportedSource || candidate.isCollidedSlot || candidate.isExtensionReserved) {
    return null;
  }

  const result = await session.analyzeSource(candidate.path);

  if (result.kind !== 'valid') {
    return null;
  }

  const directTool = getEveDefinition(result.analysis, 'tool');
  const workflowTool = getEveDefinition(result.analysis, 'workflow-tool');
  const definition = directTool.kind === 'present-supported' ? directTool : workflowTool;
  const helperKind = directTool.kind === 'present-supported' ? 'tool' : 'workflow-tool';

  if (definition.kind !== 'present-supported') {
    return null;
  }

  const description = getEvePropertyExpression(definition.properties, 'description');
  const availabilityMember = definition.properties.get('availableInSubagents');
  const availabilityExpression = getEvePropertyExpression(
    definition.properties,
    'availableInSubagents',
  );
  const availability =
    availabilityMember === undefined
      ? 'absent'
      : availabilityExpression?.kind === ts.SyntaxKind.TrueKeyword
        ? 'enabled'
        : availabilityExpression?.kind === ts.SyntaxKind.FalseKeyword
          ? 'disabled'
          : 'unknown';
  const inputSchema = getEvePropertyExpression(definition.properties, 'inputSchema');
  const executionExpression = getEvePropertyExpression(definition.properties, 'execution');
  const executionValue =
    executionExpression === null
      ? null
      : await resolveEveStaticString(session, result.analysis, executionExpression);
  const execution = !definition.properties.has('execution')
    ? 'foreground'
    : executionValue?.kind === 'supported' && executionValue.value === 'background'
      ? 'background'
      : 'unknown';
  const executeMember = definition.properties.get('execute');
  const toModelOutput = definition.properties.get('toModelOutput');
  const hasSupportedMembers = [...definition.properties].every(([key, member]) => {
    if (!ALLOWED_TOOL_KEYS.has(key) && !(helperKind === 'workflow-tool' && key === 'execution')) {
      return false;
    }

    return (
      ts.isPropertyAssignment(member) ||
      ((key === 'execute' || key === 'toModelOutput') && ts.isMethodDeclaration(member))
    );
  });
  const executeSupported =
    executeMember !== undefined &&
    (ts.isMethodDeclaration(executeMember) ||
      (ts.isPropertyAssignment(executeMember) &&
        (await isEveResolvedFunctionValue(session, result.analysis, executeMember.initializer))));
  const workflowExecutor =
    helperKind === 'workflow-tool'
      ? executeMember !== undefined
        ? await classifyEveWorkflowExecutor(session, result.analysis, executeMember)
        : 'invalid'
      : null;
  const toModelOutputSupported =
    toModelOutput === undefined ||
    ts.isMethodDeclaration(toModelOutput) ||
    (ts.isPropertyAssignment(toModelOutput) &&
      (await isEveResolvedFunctionValue(session, result.analysis, toModelOutput.initializer)));
  const isRegistrationEligible =
    hasSupportedMembers &&
    availability !== 'unknown' &&
    execution !== 'unknown' &&
    description !== null &&
    inputSchema !== null &&
    executeSupported &&
    (workflowExecutor === null || workflowExecutor === 'valid') &&
    toModelOutputSupported &&
    (await isApprovalSupported(session, result.analysis, definition.properties.get('approval'))) &&
    (await resolveEveStaticString(session, result.analysis, description)).kind === 'supported';

  return Object.freeze({
    analysis: result.analysis,
    availability,
    candidate,
    definition,
    execution,
    helperKind,
    isRegistrationEligible,
    workflowExecutor,
  });
};

const selectTool = (
  prepared: readonly IPreparedTool[],
  tool: IToolManifestEntry,
): IPreparedTool | null => {
  const nameMatches = prepared.filter(({ candidate }) => candidate.runtimeName === tool.name);

  if (nameMatches.length === 1) {
    return nameMatches[0] ?? null;
  }

  const implementationMatches = prepared.filter(
    ({ candidate }) => candidate.path === tool.implementation.path,
  );

  if (implementationMatches.length === 1) {
    return implementationMatches[0] ?? null;
  }

  const registrationMatches = prepared.filter(
    ({ candidate }) => candidate.path === tool.registration?.path,
  );
  return registrationMatches.length === 1 ? (registrationMatches[0] ?? null) : null;
};

const selectToolCandidate = (
  candidates: readonly IEveToolCandidate[],
  tool: IToolManifestEntry,
): IEveToolCandidate | null => {
  const nameMatches = candidates.filter(({ runtimeName }) => runtimeName === tool.name);

  if (nameMatches.length === 1) {
    return nameMatches[0] ?? null;
  }

  const implementationMatches = candidates.filter(({ path }) => path === tool.implementation.path);

  if (implementationMatches.length === 1) {
    return implementationMatches[0] ?? null;
  }

  const registrationMatches = candidates.filter(({ path }) => path === tool.registration?.path);
  return registrationMatches.length === 1 ? (registrationMatches[0] ?? null) : null;
};

const inspectToolSchema = async (
  session: IEveInspectionSession,
  definition: IEveAgentDefinition,
  prepared: IPreparedTool,
  capabilityId: string,
  role: 'input' | 'output',
  tool: IToolManifestEntry,
  evidence: IRuntimeAdapterEvidence[],
  diagnostics: IAdapterDiagnostic[],
): Promise<void> => {
  const reference = role === 'input' ? tool.inputSchema : tool.outputSchema;

  if (reference?.symbol === undefined) {
    return;
  }

  const referenceSource = await session.analyzeSource(reference.path);

  if (
    addEveSourceFailureDiagnostic(
      diagnostics,
      referenceSource,
      reference.path,
      definition.agent.id,
      'tool',
      capabilityId,
    )
  ) {
    return;
  }

  const propertyName = role === 'input' ? 'inputSchema' : 'outputSchema';
  const state = await classifyEveBoundExpression(
    session,
    prepared.analysis,
    getEvePropertyExpression(prepared.definition.properties, propertyName),
    reference,
  );
  const prefix = role === 'input' ? 'INPUT' : 'OUTPUT';

  if (state === 'missing') {
    addEveDiagnostic(
      diagnostics,
      `EVE_TOOL_${prefix}_SCHEMA_SYMBOL_NOT_FOUND`,
      reference.path,
      definition.agent.id,
      null,
      'tool',
      capabilityId,
    );
  } else if (state === 'wired') {
    evidence.push(
      createEveEvidence({
        agentId: definition.agent.id,
        capabilityId,
        capabilityKind: 'tool',
        details: { schemaRole: `tool-${role}` },
        kind: 'schema',
        references: [reference],
        runtimeName: reference.symbol,
        source: EVE_ADAPTER_ID,
      }),
    );
  } else if (state === 'different') {
    addEveDiagnostic(
      diagnostics,
      `EVE_TOOL_${prefix}_SCHEMA_NOT_WIRED`,
      prepared.candidate.path,
      definition.agent.id,
      null,
      'tool',
      capabilityId,
    );
  }
};

/** Inspects recursive static Eve tools declared by one scoped agent. */
export const inspectEveTools = async (
  session: IEveInspectionSession,
  definition: IEveAgentDefinition,
  evidence: IRuntimeAdapterEvidence[],
  diagnostics: IAdapterDiagnostic[],
): Promise<ReadonlySet<string>> => {
  const testExclusionBehavior = definition.inspectedPackage.testExclusionBehavior;
  const sourceCandidates = definition.rootIndex.toolCandidates.filter(
    ({ isTestSource }) => !isTestSource || testExclusionBehavior === 'before',
  );
  const prepared: IPreparedTool[] = [];

  for (let index = 0; index < sourceCandidates.length; index += TOOL_PREPARATION_BATCH_SIZE) {
    const batch = await Promise.all(
      sourceCandidates
        .slice(index, index + TOOL_PREPARATION_BATCH_SIZE)
        .map((candidate) => prepareTool(session, candidate)),
    );
    prepared.push(...batch.filter((candidate): candidate is IPreparedTool => candidate !== null));
  }
  const runtimeGroups = new Map<string, IEveToolCandidate[]>();

  for (const candidate of sourceCandidates) {
    if (
      !candidate.isSupportedSource ||
      candidate.isCollidedSlot ||
      candidate.isExtensionReserved ||
      candidate.runtimeName === EVE_RESERVED_TOOL_NAME ||
      candidate.segments.some((segment) => !EVE_TOOL_NAME_PATTERN.test(segment))
    ) {
      continue;
    }

    const group = runtimeGroups.get(candidate.runtimeName) ?? [];
    group.push(candidate);
    runtimeGroups.set(candidate.runtimeName, group);
  }

  const collidedNames = new Set<string>();

  for (const [runtimeName, candidates] of runtimeGroups) {
    if (candidates.length < 2) {
      continue;
    }

    collidedNames.add(runtimeName);
    const sorted = candidates.map(({ path }) => path).sort(compareEveStrings);
    addEveDiagnostic(
      diagnostics,
      'EVE_TOOL_RUNTIME_NAME_COLLISION',
      sorted[0] ?? null,
      definition.agent.id,
      null,
      undefined,
      undefined,
      { conflictingPaths: sorted.join(',') },
    );
  }

  for (const [capabilityId, tool] of Object.entries(definition.agent.declaration.tools ?? {})) {
    const affectedTestSource = definition.rootIndex.toolCandidates.find(
      ({ isTestSource, path, runtimeName }) =>
        isTestSource &&
        (path === tool.registration?.path ||
          path === tool.implementation.path ||
          runtimeName === tool.name),
    );

    if (affectedTestSource !== undefined && testExclusionBehavior !== 'before') {
      if (testExclusionBehavior === 'after') {
        if (
          affectedTestSource.path === tool.registration?.path ||
          affectedTestSource.path === tool.implementation.path
        ) {
          addEveDiagnostic(
            diagnostics,
            'EVE_TOOL_REGISTRATION_NOT_WIRED',
            affectedTestSource.path,
            definition.agent.id,
            null,
            'tool',
            capabilityId,
          );
          continue;
        }
      } else {
        addEveWarning(
          diagnostics,
          affectedTestSource.path,
          definition.agent.id,
          {
            boundaryVersion: EVE_TEST_EXCLUSION_BOUNDARY_VERSION,
            declaredRange: definition.inspectedPackage.declaredRange,
            packageName: 'eve',
            reason: 'version-dependent-behavior',
            relationship: 'tool-registration',
          },
          'tool',
          capabilityId,
        );
        continue;
      }
    }

    const selected = selectTool(prepared, tool);

    if (selected === null) {
      const candidate = selectToolCandidate(sourceCandidates, tool);

      if (
        candidate !== null &&
        candidate.isSupportedSource &&
        !candidate.isCollidedSlot &&
        !candidate.isExtensionReserved
      ) {
        addEveSourceFailureDiagnostic(
          diagnostics,
          await session.analyzeSource(candidate.path),
          candidate.path,
          definition.agent.id,
          'tool',
          capabilityId,
        );
      }

      continue;
    }

    const { candidate } = selected;
    if (selected.helperKind === 'workflow-tool') {
      const behavior = definition.inspectedPackage.workflowToolBehavior;

      if (behavior === 'before') {
        addEveDiagnostic(
          diagnostics,
          'EVE_SDK_FEATURE_UNAVAILABLE',
          candidate.path,
          definition.agent.id,
          null,
          'tool',
          capabilityId,
          { feature: 'workflow-tool' },
        );
        continue;
      }

      if (behavior === null) {
        addEveWarning(
          diagnostics,
          candidate.path,
          definition.agent.id,
          {
            boundaryVersion: EVE_WORKFLOW_TOOL_BOUNDARY_VERSION,
            declaredRange: definition.inspectedPackage.declaredRange,
            packageName: 'eve',
            reason: 'version-dependent-behavior',
            relationship: 'tool-registration',
          },
          'tool',
          capabilityId,
        );
        continue;
      }
    }

    if (selected.availability !== 'absent') {
      const behavior = definition.inspectedPackage.availableInSubagentsBehavior;

      if (behavior === 'before') {
        addEveDiagnostic(
          diagnostics,
          'EVE_SDK_FEATURE_UNAVAILABLE',
          candidate.path,
          definition.agent.id,
          null,
          'tool',
          capabilityId,
          { feature: 'subagent-tool-exposure' },
        );
        continue;
      }

      if (behavior === null) {
        addEveWarning(
          diagnostics,
          candidate.path,
          definition.agent.id,
          {
            boundaryVersion: EVE_SUBAGENT_TOOL_EXPOSURE_BOUNDARY_VERSION,
            declaredRange: definition.inspectedPackage.declaredRange,
            packageName: 'eve',
            reason: 'version-dependent-behavior',
            relationship: 'tool-registration',
          },
          'tool',
          capabilityId,
        );
        continue;
      }
    }

    if (selected.workflowExecutor === 'invalid') {
      addEveDiagnostic(
        diagnostics,
        'EVE_WORKFLOW_EXECUTOR_NOT_WIRED',
        candidate.path,
        definition.agent.id,
        null,
        'tool',
        capabilityId,
      );
      continue;
    }

    if (selected.workflowExecutor === 'unknown') {
      addEveWarning(
        diagnostics,
        candidate.path,
        definition.agent.id,
        { reason: 'dynamic-source-pattern', relationship: 'tool-registration' },
        'tool',
        capabilityId,
      );
      continue;
    }

    if (selected.availability === 'unknown') {
      addEveWarning(
        diagnostics,
        candidate.path,
        definition.agent.id,
        { reason: 'dynamic-source-pattern', relationship: 'tool-registration' },
        'tool',
        capabilityId,
      );
      continue;
    }
    if (selected.execution === 'unknown') {
      addEveWarning(
        diagnostics,
        candidate.path,
        definition.agent.id,
        { reason: 'dynamic-source-pattern', relationship: 'tool-registration' },
        'tool',
        capabilityId,
      );
      continue;
    }
    const invalidSegmentIndex = candidate.segments.findIndex(
      (segment) => !EVE_TOOL_NAME_PATTERN.test(segment),
    );
    const isReserved = candidate.runtimeName === EVE_RESERVED_TOOL_NAME;
    const canDiagnoseRegistration =
      invalidSegmentIndex < 0 && !isReserved && !collidedNames.has(candidate.runtimeName);

    if (invalidSegmentIndex >= 0) {
      addEveDiagnostic(
        diagnostics,
        'EVE_TOOL_NAME_INVALID',
        candidate.path,
        definition.agent.id,
        null,
        'tool',
        capabilityId,
        { segmentIndex: invalidSegmentIndex },
      );
    } else if (isReserved) {
      addEveDiagnostic(
        diagnostics,
        'EVE_TOOL_NAME_RESERVED',
        candidate.path,
        definition.agent.id,
        null,
        'tool',
        capabilityId,
      );
    }

    let implementationKind: 'bound-function' | 'inline' | null = null;

    if (
      tool.implementation.path === candidate.path &&
      (tool.implementation.symbol === undefined || tool.implementation.symbol === 'default')
    ) {
      implementationKind = 'inline';
    } else if (tool.implementation.symbol !== undefined) {
      const implementationSource = await session.analyzeSource(tool.implementation.path);

      if (
        !addEveSourceFailureDiagnostic(
          diagnostics,
          implementationSource,
          tool.implementation.path,
          definition.agent.id,
          'tool',
          capabilityId,
        )
      ) {
        const execute = selected.definition.properties.get('execute');
        const state = await classifyEveBoundExpression(
          session,
          selected.analysis,
          execute !== undefined && ts.isPropertyAssignment(execute) ? execute.initializer : null,
          tool.implementation,
          true,
        );

        if (state === 'missing') {
          addEveDiagnostic(
            diagnostics,
            'EVE_TOOL_IMPLEMENTATION_SYMBOL_NOT_FOUND',
            tool.implementation.path,
            definition.agent.id,
            null,
            'tool',
            capabilityId,
          );
        } else if (state === 'wired') {
          implementationKind = 'bound-function';
        } else if (state === 'different') {
          addEveDiagnostic(
            diagnostics,
            'EVE_TOOL_IMPLEMENTATION_NOT_WIRED',
            candidate.path,
            definition.agent.id,
            null,
            'tool',
            capabilityId,
          );
        }
      }
    }

    await inspectToolSchema(
      session,
      definition,
      selected,
      capabilityId,
      'input',
      tool,
      evidence,
      diagnostics,
    );
    await inspectToolSchema(
      session,
      definition,
      selected,
      capabilityId,
      'output',
      tool,
      evidence,
      diagnostics,
    );

    const registration = tool.registration;
    let isRegistrationWired = registration === undefined;
    let isRegistrationResolved = true;

    if (registration !== undefined) {
      if (
        registration.path === candidate.path &&
        (registration.symbol === undefined || registration.symbol === 'default')
      ) {
        isRegistrationWired = true;
      } else if (registration.symbol === 'default') {
        const registrationResult = await session.analyzeSource(registration.path);

        if (
          addEveSourceFailureDiagnostic(
            diagnostics,
            registrationResult,
            registration.path,
            definition.agent.id,
            'tool',
            capabilityId,
          )
        ) {
          isRegistrationResolved = false;
        }
        const registrationDefinition =
          registrationResult.kind === 'valid'
            ? getEveDefinition(registrationResult.analysis, 'tool')
            : null;

        if (registrationDefinition?.kind === 'absent') {
          if (canDiagnoseRegistration) {
            addEveDiagnostic(
              diagnostics,
              'EVE_TOOL_REGISTRATION_SYMBOL_NOT_FOUND',
              registration.path,
              definition.agent.id,
              null,
              'tool',
              capabilityId,
            );
          }
          isRegistrationResolved = false;
        } else if (registrationDefinition?.kind === 'present-supported') {
          if (canDiagnoseRegistration) {
            addEveDiagnostic(
              diagnostics,
              'EVE_TOOL_REGISTRATION_NOT_WIRED',
              selected.candidate.path,
              definition.agent.id,
              null,
              'tool',
              capabilityId,
            );
          }
        } else {
          isRegistrationResolved = false;
        }
      } else if (registration.symbol === undefined) {
        if (canDiagnoseRegistration) {
          addEveDiagnostic(
            diagnostics,
            'EVE_TOOL_REGISTRATION_NOT_WIRED',
            candidate.path,
            definition.agent.id,
            null,
            'tool',
            capabilityId,
          );
        }
      }
    }

    const canRegister =
      selected.isRegistrationEligible &&
      implementationKind !== null &&
      isRegistrationWired &&
      isRegistrationResolved &&
      invalidSegmentIndex < 0 &&
      !isReserved &&
      !collidedNames.has(candidate.runtimeName);

    if (!canRegister) {
      continue;
    }

    if (tool.name !== candidate.runtimeName) {
      addEveDiagnostic(
        diagnostics,
        'EVE_TOOL_NAME_MISMATCH',
        candidate.path,
        definition.agent.id,
        null,
        'tool',
        capabilityId,
      );
      continue;
    }

    const references = [
      { path: candidate.path },
      ...(tool.implementation.path === candidate.path ? [] : [tool.implementation]),
    ];
    evidence.push(
      createEveEvidence({
        agentId: definition.agent.id,
        capabilityId,
        capabilityKind: 'tool',
        details: {
          implementationKind,
          pathDepth: candidate.segments.length,
          registrationKind:
            selected.helperKind === 'workflow-tool'
              ? 'filesystem-workflow-tool'
              : 'filesystem-tool',
          ...(selected.availability === 'absent'
            ? {}
            : { declaredAvailableInSubagents: selected.availability }),
          ...(selected.helperKind === 'workflow-tool'
            ? { declaredExecution: selected.execution }
            : {}),
        },
        kind: 'tool-registration',
        references,
        runtimeName: candidate.runtimeName,
        source: EVE_ADAPTER_ID,
      }),
    );
  }

  return new Set(
    prepared
      .filter(
        ({ availability, candidate, helperKind, isRegistrationEligible }) =>
          isRegistrationEligible &&
          (availability === 'absent' ||
            definition.inspectedPackage.availableInSubagentsBehavior === 'after') &&
          (helperKind === 'tool' || definition.inspectedPackage.workflowToolBehavior === 'after') &&
          !collidedNames.has(candidate.runtimeName) &&
          candidate.runtimeName !== EVE_RESERVED_TOOL_NAME &&
          candidate.segments.every((segment) => EVE_TOOL_NAME_PATTERN.test(segment)),
      )
      .map(({ candidate }) => candidate.runtimeName),
  );
};
