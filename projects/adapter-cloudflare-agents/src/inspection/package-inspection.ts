import { intersects, subset, validRange } from 'semver';

import { classifyVersionBehavior, type IVersionBehavior } from '@moldea.ai/adapter-static-analysis';

import type { IRuntimeAdapterEvidence } from '@moldea.ai/core';
import type { IAdapterDiagnostic } from '@moldea.ai/core/adapter';
import type { IRepositoryPath } from '@moldea.ai/repository';

import {
  AI_SDK_PACKAGE_NAME,
  AI_SDK_SUPPORTED_RANGE,
  CLOUDFLARE_AGENTS_ADAPTER_ID,
  CLOUDFLARE_AGENTS_PACKAGE_NAME,
  CLOUDFLARE_AGENTS_SUPPORTED_RANGE,
  CLOUDFLARE_AI_CHAT_PACKAGE_NAME,
  CLOUDFLARE_AI_CHAT_SUPPORTED_RANGE,
  CLOUDFLARE_AI_CHAT_TARGET_ID,
  CLOUDFLARE_THINK_PACKAGE_NAME,
  CLOUDFLARE_THINK_CONTEXT_BOUNDARY_VERSION,
  CLOUDFLARE_THINK_SUPPORTED_RANGE,
  CLOUDFLARE_THINK_TARGET_ID,
} from '../constants/index.js';
import type {
  ICloudflareAgentsInspectionSession,
  ICloudflareAgentsPackageCompatibility,
  ICloudflareAgentsPackageDeclaration,
  ICloudflareAgentsTargetId,
} from '../contracts/index.js';
import { addCloudflareAgentsDiagnostic, createCloudflareAgentsEvidence } from './common.js';

const classifyDeclaration = (
  declaration: ICloudflareAgentsPackageDeclaration,
  supportedRange: string,
): ICloudflareAgentsPackageCompatibility => {
  const normalized = validRange(declaration.declaredRange, {
    includePrerelease: false,
    loose: false,
  });

  if (normalized === null) {
    return 'ambiguous';
  }

  if (subset(normalized, supportedRange, { includePrerelease: false, loose: false })) {
    return 'supported';
  }

  return intersects(normalized, supportedRange, { includePrerelease: false, loose: false })
    ? 'ambiguous'
    : 'unsupported';
};

const getTargetPackages = (
  targetId: ICloudflareAgentsTargetId,
): readonly { readonly packageName: string; readonly supportedRange: string }[] =>
  Object.freeze([
    targetId === CLOUDFLARE_AI_CHAT_TARGET_ID
      ? {
          packageName: CLOUDFLARE_AI_CHAT_PACKAGE_NAME,
          supportedRange: CLOUDFLARE_AI_CHAT_SUPPORTED_RANGE,
        }
      : {
          packageName: CLOUDFLARE_THINK_PACKAGE_NAME,
          supportedRange: CLOUDFLARE_THINK_SUPPORTED_RANGE,
        },
    {
      packageName: CLOUDFLARE_AGENTS_PACKAGE_NAME,
      supportedRange: CLOUDFLARE_AGENTS_SUPPORTED_RANGE,
    },
    { packageName: AI_SDK_PACKAGE_NAME, supportedRange: AI_SDK_SUPPORTED_RANGE },
  ]);

// version evidence is retained separately from package eligibility
export interface ICloudflareAgentsPackageInspection {
  readonly declaredThinkRange: string | null;
  readonly thinkBehavior: IVersionBehavior | null;
}

/** Inspects exact package declarations and gates one verified target. */
export const inspectCloudflareAgentsPackage = async (
  session: ICloudflareAgentsInspectionSession,
  sourcePath: IRepositoryPath,
  targetId: ICloudflareAgentsTargetId,
  evidence: IRuntimeAdapterEvidence[],
  diagnostics: IAdapterDiagnostic[],
  agentId: string,
): Promise<ICloudflareAgentsPackageInspection | null> => {
  const discovery = await session.discoverPackage(sourcePath);

  if (discovery.kind === 'absent') {
    return null;
  }

  if (discovery.kind === 'invalid') {
    addCloudflareAgentsDiagnostic(
      diagnostics,
      'CLOUDFLARE_AGENTS_PACKAGE_MANIFEST_INVALID',
      discovery.path,
      agentId,
    );
    return null;
  }

  for (const targetPackage of getTargetPackages(targetId)) {
    const declarations = discovery.observation.declarations.get(targetPackage.packageName);

    if (declarations === undefined || declarations.length === 0) {
      return null;
    }

    for (const declaration of declarations) {
      const compatibility = classifyDeclaration(declaration, targetPackage.supportedRange);

      if (compatibility === 'unsupported') {
        addCloudflareAgentsDiagnostic(
          diagnostics,
          'CLOUDFLARE_AGENTS_RUNTIME_VERSION_UNSUPPORTED',
          discovery.observation.path,
          agentId,
          null,
          undefined,
          {
            declaredRange: declaration.declaredRange,
            packageName: targetPackage.packageName,
            targetId,
          },
        );
        return null;
      }

      evidence.push(
        createCloudflareAgentsEvidence({
          agentId,
          capabilityId: null,
          capabilityKind: null,
          details: {
            compatibility,
            declaredRange: declaration.declaredRange,
            dependencyKind: declaration.dependencyKind,
            targetId,
          },
          kind: 'runtime-package',
          references: [{ path: discovery.observation.path }],
          runtimeName: targetPackage.packageName,
          source: CLOUDFLARE_AGENTS_ADAPTER_ID,
        }),
      );
    }
  }

  const thinkDeclarations =
    discovery.observation.declarations.get(CLOUDFLARE_THINK_PACKAGE_NAME) ?? [];

  return Object.freeze({
    declaredThinkRange:
      targetId === CLOUDFLARE_THINK_TARGET_ID && thinkDeclarations.length === 1
        ? validRange(thinkDeclarations[0]?.declaredRange ?? '', {
            includePrerelease: false,
            loose: false,
          })
        : null,
    thinkBehavior:
      targetId === CLOUDFLARE_THINK_TARGET_ID
        ? classifyVersionBehavior(thinkDeclarations, CLOUDFLARE_THINK_CONTEXT_BOUNDARY_VERSION)
        : null,
  });
};
