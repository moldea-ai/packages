import type { IDiagnostic } from '@moldea.ai/core';
import type { IRepositoryEntry } from '@moldea.ai/repository';
import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

import type { ICapabilityFile } from './types.ts';

/** Copies only public diagnostic fields, excluding additive process metadata. */
export const projectDiagnostics = (diagnostics: readonly IDiagnostic[]): IDiagnostic[] =>
  diagnostics.map((diagnostic): IDiagnostic => {
    const { source, group, message, path, pointer, entity, range, details } = diagnostic;
    const base = {
      source,
      group,
      message,
      path,
      pointer,
      details: { ...details },
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
              ...(entity.contextPath === undefined ? {} : { contextPath: entity.contextPath }),
              ...(entity.integrationPath === undefined
                ? {}
                : { integrationPath: entity.integrationPath }),
            },
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
    };
    if (diagnostic.severity === 'error')
      return { ...base, code: diagnostic.code, severity: diagnostic.severity };
    const warning = {
      ...base,
      code: diagnostic.code,
      severity: diagnostic.severity,
      subject: diagnostic.subject,
      qualifier: diagnostic.qualifier,
      acceptable: diagnostic.acceptable,
    };
    return diagnostic.accepted === true
      ? { ...warning, accepted: true, reason: diagnostic.reason }
      : warning;
  });

/** Publishes logical entry metadata without opaque content identities. */
export const projectEntry = ({ path, type, byteLength }: IRepositoryEntry) => ({
  path,
  type,
  byteLength,
});

/** Selects a bounded, explicitly labelled excerpt from the executed synthetic file. */
export const projectFile = (
  entry: IMemoryRepositoryEntry,
  options: { maxLines?: number } = {},
): ICapabilityFile | null => {
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
      : entry.path.endsWith('.js') || entry.path.endsWith('.mjs') || entry.path.endsWith('.cjs')
        ? 'javascript'
        : entry.path.endsWith('.ts')
          ? 'typescript'
          : 'markdown';
  const lines = entry.content.split('\n');
  const maxLines = options.maxLines ?? 16;
  return {
    path: entry.path,
    language,
    content: lines.slice(0, maxLines).join('\n'),
    isExcerpt: lines.length > maxLines,
    representation: 'source',
  };
};
