import type { IAdapterDiagnostic, IDiagnostic, IRuntimeAdapterEvidence } from '@moldea.ai/core';
import type { IRepositoryEntry } from '@moldea.ai/repository';
import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

import type { ICapabilityFile } from './types.ts';

/** Copies the diagnostic contract explicitly, excluding unexpected additive fields. */
export const projectDiagnostics = (diagnostics: readonly IDiagnostic[]): IAdapterDiagnostic[] =>
  diagnostics.map((diagnostic): IAdapterDiagnostic => {
    const projected = {
      code: diagnostic.code,
      source: diagnostic.source,
      message: diagnostic.message,
      path: diagnostic.path,
      pointer: diagnostic.pointer,
      range:
        diagnostic.range === null
          ? null
          : {
              start: {
                line: diagnostic.range.start.line,
                column: diagnostic.range.start.column,
                offset: diagnostic.range.start.offset,
              },
              end: {
                line: diagnostic.range.end.line,
                column: diagnostic.range.end.column,
                offset: diagnostic.range.end.offset,
              },
            },
      entity:
        diagnostic.entity === null
          ? null
          : {
              ...(diagnostic.entity.agentId === undefined
                ? {}
                : { agentId: diagnostic.entity.agentId }),
              ...(diagnostic.entity.capabilityId === undefined
                ? {}
                : { capabilityId: diagnostic.entity.capabilityId }),
              ...(diagnostic.entity.capabilityKind === undefined
                ? {}
                : { capabilityKind: diagnostic.entity.capabilityKind }),
              ...(diagnostic.entity.decisionId === undefined
                ? {}
                : { decisionId: diagnostic.entity.decisionId }),
              ...(diagnostic.entity.variableId === undefined
                ? {}
                : { variableId: diagnostic.entity.variableId }),
              ...(diagnostic.entity.adapterId === undefined
                ? {}
                : { adapterId: diagnostic.entity.adapterId }),
            },
    };

    if (diagnostic.severity === 'warning') {
      const details =
        diagnostic.details.reason === 'version-dependent-behavior'
          ? {
              relationship: diagnostic.details.relationship,
              reason: diagnostic.details.reason,
              packageName: diagnostic.details.packageName,
              declaredRange: diagnostic.details.declaredRange,
              boundaryVersion: diagnostic.details.boundaryVersion,
            }
          : {
              relationship: diagnostic.details.relationship,
              reason: diagnostic.details.reason,
            };

      return { ...projected, details, severity: 'warning' };
    }

    return { ...projected, details: { ...diagnostic.details }, severity: 'error' };
  });

/** Retains the public relationship fields, never the reader snapshot or executable source. */
export const projectEvidence = (
  evidence: readonly IRuntimeAdapterEvidence[],
): IRuntimeAdapterEvidence[] =>
  evidence.map(
    ({
      source,
      kind,
      agentId,
      capabilityId,
      capabilityKind,
      runtimeName,
      references,
      details,
    }) => ({
      source,
      kind,
      agentId,
      capabilityId,
      capabilityKind,
      runtimeName,
      references: references.map(({ path, symbol }) =>
        symbol === undefined ? { path } : { path, symbol },
      ),
      details: { ...details },
    }),
  );

/** Publishes logical entry metadata without opaque content identities. */
export const projectEntry = ({ path, type, byteLength }: IRepositoryEntry) => ({
  path,
  type,
  byteLength,
});

/** Selects a bounded, explicitly labelled excerpt from the executed synthetic file. */
export const projectFile = (entry: IMemoryRepositoryEntry): ICapabilityFile | null => {
  if (entry.type !== 'file') return null;
  if (typeof entry.content !== 'string') {
    return {
      path: entry.path,
      language: 'text',
      content: `Bytes: ${[...entry.content].map((byte) => byte.toString(16).padStart(2, '0')).join(' ')}`,
      isExcerpt: false,
      representation: 'bytes',
    };
  }
  if (!entry.content.isWellFormed() || entry.content.includes('\u0000')) {
    return {
      path: entry.path,
      language: 'json',
      content: JSON.stringify(entry.content),
      isExcerpt: false,
      representation: 'json-string',
    };
  }
  const language = entry.path.endsWith('.yaml')
    ? 'yaml'
    : entry.path.endsWith('.json')
      ? 'json'
      : entry.path.endsWith('.ts')
        ? 'typescript'
        : 'markdown';
  const lines = entry.content.split('\n');
  return {
    path: entry.path,
    language,
    content: lines.slice(0, 16).join('\n'),
    isExcerpt: lines.length > 16,
    representation: 'source',
  };
};
