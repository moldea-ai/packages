import type { IDiagnostic, IRuntimeAdapterEvidence } from '@moldea.ai/core';
import type { IRepositoryEntry } from '@moldea.ai/repository';
import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

import type { ICapabilityFile } from './types.ts';

/** Copies the diagnostic contract explicitly, excluding unexpected additive fields. */
export const projectDiagnostics = (diagnostics: readonly IDiagnostic[]): IDiagnostic[] =>
  diagnostics.map(({ code, source, message, path, pointer, range, entity, details }) => ({
    code,
    source,
    message,
    path,
    pointer,
    range:
      range === null
        ? null
        : {
            start: {
              line: range.start.line,
              column: range.start.column,
              offset: range.start.offset,
            },
            end: { line: range.end.line, column: range.end.column, offset: range.end.offset },
          },
    entity:
      entity === null
        ? null
        : {
            ...(entity.agentId === undefined ? {} : { agentId: entity.agentId }),
            ...(entity.capabilityId === undefined ? {} : { capabilityId: entity.capabilityId }),
            ...(entity.capabilityKind === undefined
              ? {}
              : { capabilityKind: entity.capabilityKind }),
            ...(entity.decisionId === undefined ? {} : { decisionId: entity.decisionId }),
            ...(entity.variableId === undefined ? {} : { variableId: entity.variableId }),
            ...(entity.adapterId === undefined ? {} : { adapterId: entity.adapterId }),
          },
    details: { ...details },
  }));

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
