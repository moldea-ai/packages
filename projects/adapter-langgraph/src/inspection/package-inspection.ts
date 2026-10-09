import { validRange } from 'semver';

import type { IRuntimeAdapterRecordCollector } from '@moldea.ai/core/adapter';
import type { IAdapterDiagnostic } from '@moldea.ai/core/adapter';
import type { IRepositoryPath } from '@moldea.ai/repository';

import type { ILangGraphEvidenceCollector } from '../contracts/index.js';
import {
  LANGGRAPH_ADAPTER_ID,
  LANGGRAPH_CORE_PACKAGE_NAME,
  LANGGRAPH_PACKAGE_NAME,
} from '../constants/index.js';
import type {
  ILangGraphInspectionSession,
  ILangGraphTargetPackageClassification,
} from '../contracts/index.js';

import { addLangGraphDiagnostic, createLangGraphEvidence } from './common.js';

const getPackageRole = (packageName: string): 'companion' | 'primary' =>
  packageName === LANGGRAPH_CORE_PACKAGE_NAME ? 'companion' : 'primary';

/**
 * Inspects the nearest owning manifest and returns the conjunctive target package state.
 * @throws
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 * - ABORTED: The Core operation was aborted.
 */
export const inspectLangGraphPackage = async (
  session: ILangGraphInspectionSession,
  sourcePath: IRepositoryPath,
  evidence: ILangGraphEvidenceCollector,
  diagnostics: IRuntimeAdapterRecordCollector<IAdapterDiagnostic>,
  agentId: string,
): Promise<ILangGraphTargetPackageClassification> => {
  const discovery = await session.discoverPackage(sourcePath);

  if (discovery.kind === 'absent') {
    return 'absent';
  }

  if (discovery.kind === 'invalid') {
    addLangGraphDiagnostic(
      diagnostics,
      'LANGGRAPH_PACKAGE_MANIFEST_INVALID',
      discovery.path,
      agentId,
    );
    return 'absent';
  }

  const { observation } = discovery;

  if (observation.targetClassification === 'absent') {
    return observation.targetClassification;
  }

  if (observation.targetClassification === 'unsupported') {
    addLangGraphDiagnostic(diagnostics, 'LANGGRAPH_VERSION_UNSUPPORTED', observation.path, agentId);
    return observation.targetClassification;
  }

  for (const packageObservation of observation.packages) {
    for (const declaration of packageObservation.declarations) {
      const isSemverRange =
        validRange(declaration.declaredRange, {
          includePrerelease: false,
          loose: false,
        }) !== null;

      evidence.add(() =>
        createLangGraphEvidence({
          agentId,
          capabilityId: null,
          capabilityKind: null,
          details: {
            classification: packageObservation.compatibility,
            dependencyKind: declaration.dependencyKind,
            ...(isSemverRange ? { declaredRange: declaration.declaredRange } : {}),
            packageName: packageObservation.packageName,
            packageRole: getPackageRole(packageObservation.packageName),
            targetClassification: observation.targetClassification,
          },
          kind: 'runtime-package',
          references: [{ path: observation.path }],
          runtimeName:
            packageObservation.packageName === LANGGRAPH_PACKAGE_NAME
              ? LANGGRAPH_PACKAGE_NAME
              : LANGGRAPH_CORE_PACKAGE_NAME,
          source: LANGGRAPH_ADAPTER_ID,
        }),
      );
    }
  }

  return observation.targetClassification;
};
