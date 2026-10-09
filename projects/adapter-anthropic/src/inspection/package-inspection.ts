import type { IRuntimeAdapterRecordCollector } from '@moldea.ai/core/adapter';
import type { IAdapterDiagnostic } from '@moldea.ai/core/adapter';
import type { IRepositoryPath } from '@moldea.ai/repository';

import type { IAnthropicEvidenceCollector } from '../contracts/index.js';
import { ANTHROPIC_ADAPTER_ID, ANTHROPIC_SDK_PACKAGE_NAME } from '../constants/index.js';
import type { IAnthropicInspectionSession } from '../contracts/index.js';

import { addAnthropicDiagnostic, createAnthropicEvidence } from './common.js';

/**
 * Inspects the nearest owning package manifest for one agent runtime source.
 * @param session The operation-local inspection session.
 * @param sourcePath The runtime-agent source path.
 * @param evidence The operation evidence collection.
 * @param diagnostics The operation diagnostic collection.
 * @param agentId The owning agent identifier.
 * @throws
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 * - ABORTED: The Core operation was aborted.
 */
export const inspectAnthropicPackage = async (
  session: IAnthropicInspectionSession,
  sourcePath: IRepositoryPath,
  evidence: IAnthropicEvidenceCollector,
  diagnostics: IRuntimeAdapterRecordCollector<IAdapterDiagnostic>,
  agentId: string,
): Promise<void> => {
  const discovery = await session.discoverPackage(sourcePath);

  if (discovery.kind === 'absent') {
    return;
  }

  if (discovery.kind === 'invalid') {
    addAnthropicDiagnostic(
      diagnostics,
      'ANTHROPIC_PACKAGE_MANIFEST_INVALID',
      discovery.path,
      agentId,
    );
    return;
  }

  const { observation } = discovery;

  if (observation.compatibility === 'unsupported') {
    addAnthropicDiagnostic(
      diagnostics,
      'ANTHROPIC_SDK_VERSION_UNSUPPORTED',
      observation.path,
      agentId,
    );
    return;
  }

  for (const declaration of observation.declarations) {
    evidence.add(() =>
      createAnthropicEvidence({
        agentId,
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: observation.compatibility,
          declaredRange: declaration.declaredRange,
          dependencyKind: declaration.dependencyKind,
        },
        kind: 'runtime-package',
        references: [{ path: observation.path }],
        runtimeName: ANTHROPIC_SDK_PACKAGE_NAME,
        source: ANTHROPIC_ADAPTER_ID,
      }),
    );
  }
};
