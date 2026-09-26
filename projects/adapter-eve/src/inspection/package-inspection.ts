import { validRange } from 'semver';

import { classifyVersionBehavior } from '@moldea.ai/adapter-static-analysis';

import type { IAdapterDiagnostic, IRuntimeAdapterEvidence } from '@moldea.ai/core/adapter';
import type { IRepositoryPath } from '@moldea.ai/repository';

import {
  EVE_ADAPTER_ID,
  EVE_AGENT_OUTPUT_SCHEMA_REMOVAL_VERSION,
  EVE_DEFAULT_TOOLS_BOUNDARY_VERSION,
  EVE_DEFAULT_TOOLS_OPTION_BOUNDARY_VERSION,
  EVE_TARGET_ID,
  EVE_TASK_CANCEL_BOUNDARY_VERSION,
  EVE_SUBAGENT_TOOL_EXPOSURE_BOUNDARY_VERSION,
  EVE_SUBAGENT_MODEL_VISIBILITY_BOUNDARY_VERSION,
  EVE_TEST_EXCLUSION_BOUNDARY_VERSION,
  EVE_WORKFLOW_TOOL_BOUNDARY_VERSION,
  EVE_WORKSPACE_AGENT_BOUNDARY_VERSION,
} from '../constants/index.js';
import type {
  IEveInspectedPackage,
  IEveInspectionSession,
  IEveScopedAgent,
} from '../contracts/index.js';
import { addEveDiagnostic, createEveEvidence } from './common.js';

/** Inspects one scoped agent's nearest Eve package declaration. */
export const inspectEvePackage = async (
  session: IEveInspectionSession,
  agent: IEveScopedAgent,
  sourcePath: IRepositoryPath,
  evidence: IRuntimeAdapterEvidence[],
  diagnostics: IAdapterDiagnostic[],
): Promise<IEveInspectedPackage | null> => {
  const result = await session.discoverPackage(sourcePath);

  if (result.kind === 'absent') {
    return null;
  }

  if (result.kind === 'invalid') {
    addEveDiagnostic(diagnostics, 'EVE_PACKAGE_MANIFEST_INVALID', result.path, agent.id);
    return null;
  }

  const { observation } = result;

  if (observation.compatibility === 'unsupported') {
    addEveDiagnostic(diagnostics, 'EVE_SDK_VERSION_UNSUPPORTED', observation.path, agent.id);
    return null;
  }

  for (const declaration of observation.declarations) {
    const isSemver =
      validRange(declaration.declaredRange, {
        includePrerelease: false,
        loose: false,
      }) !== null;

    evidence.push(
      createEveEvidence({
        agentId: agent.id,
        capabilityId: null,
        capabilityKind: null,
        details: {
          dependencyKind: declaration.dependencyKind,
          ...(isSemver ? { declaredRange: declaration.declaredRange } : {}),
          packageClassification: observation.compatibility,
          targetId: EVE_TARGET_ID,
        },
        kind: 'runtime-package',
        references: [{ path: observation.path }],
        runtimeName: null,
        source: EVE_ADAPTER_ID,
      }),
    );
  }

  const normalizedRanges = observation.declarations.map(({ declaredRange }) =>
    validRange(declaredRange, { includePrerelease: false, loose: false }),
  );

  return Object.freeze({
    agentOutputSchemaBehavior: classifyVersionBehavior(
      observation.declarations,
      EVE_AGENT_OUTPUT_SCHEMA_REMOVAL_VERSION,
    ),
    availableInSubagentsBehavior: classifyVersionBehavior(
      observation.declarations,
      EVE_SUBAGENT_TOOL_EXPOSURE_BOUNDARY_VERSION,
    ),
    declaredRange:
      normalizedRanges.length > 0 && normalizedRanges.every((range) => range !== null)
        ? validRange(normalizedRanges.join(' || '), { includePrerelease: false, loose: false })
        : null,
    defaultToolBehavior: classifyVersionBehavior(
      observation.declarations,
      EVE_DEFAULT_TOOLS_BOUNDARY_VERSION,
    ),
    defaultToolsOptionBehavior: classifyVersionBehavior(
      observation.declarations,
      EVE_DEFAULT_TOOLS_OPTION_BOUNDARY_VERSION,
    ),
    observation,
    subagentModelVisibilityBehavior: classifyVersionBehavior(
      observation.declarations,
      EVE_SUBAGENT_MODEL_VISIBILITY_BOUNDARY_VERSION,
    ),
    taskCancelBehavior: classifyVersionBehavior(
      observation.declarations,
      EVE_TASK_CANCEL_BOUNDARY_VERSION,
    ),
    testExclusionBehavior: classifyVersionBehavior(
      observation.declarations,
      EVE_TEST_EXCLUSION_BOUNDARY_VERSION,
    ),
    workflowToolBehavior: classifyVersionBehavior(
      observation.declarations,
      EVE_WORKFLOW_TOOL_BOUNDARY_VERSION,
    ),
    workspaceAgentBehavior: classifyVersionBehavior(
      observation.declarations,
      EVE_WORKSPACE_AGENT_BOUNDARY_VERSION,
    ),
  });
};
