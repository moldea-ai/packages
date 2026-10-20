import { deepFreeze } from 'jg-utilities';

import { parseRepositoryPath } from '@moldea.ai/repository';

import type { ICoreResourceLimits } from '../contracts/index.js';
import {
  createCoreDiagnosticCollector,
  normalizeDiagnostics,
} from '../diagnostic-utilities/index.js';
import type { ICoreDiagnostic, ICoreWarningCode } from '../diagnostics/index.js';
import type { IAcceptedWarningManifestEntry } from '../format/index.js';

const identity = (entry: { code: string; subject: string; qualifier?: string | null }): string =>
  JSON.stringify([entry.code, entry.subject, entry.qualifier ?? null]);

/**
 * Applies explicit manifest acceptances only to checks that completed, retaining all findings.
 * @returns Normalized diagnostics with acceptance flags, reasons, and obsolete-acceptance warnings.
 * @throws
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 */
export const applyWarningAcceptances = (
  diagnostics: readonly ICoreDiagnostic[],
  entries: readonly IAcceptedWarningManifestEntry[],
  completed: ReadonlySet<ICoreWarningCode>,
  limits: ICoreResourceLimits,
): readonly ICoreDiagnostic[] => {
  const acceptances = new Map(entries.map((entry, index) => [identity(entry), { entry, index }]));
  const matched = new Set<string>();
  const results = diagnostics.map((diagnostic) => {
    if (
      diagnostic.severity !== 'warning' ||
      !diagnostic.acceptable ||
      !completed.has(diagnostic.code)
    )
      return diagnostic;
    const key = identity(diagnostic);
    const acceptance = acceptances.get(key);
    if (acceptance === undefined) return diagnostic;
    matched.add(key);
    return deepFreeze({
      ...diagnostic,
      accepted: true as const,
      reason: acceptance.entry.reason,
    });
  });
  const collector = createCoreDiagnosticCollector(limits, 'validate-project');
  for (const [key, { entry, index }] of acceptances) {
    if (matched.has(key) || !completed.has(entry.code)) continue;
    const pointer = `/acceptedWarnings/${index}`;
    collector.add({
      code: 'MOLDEA_ACCEPTANCE_UNMATCHED',
      path: parseRepositoryPath('/moldea/moldea.yaml'),
      pointer,
      subject: parseRepositoryPath('/moldea/moldea.yaml'),
      qualifier: pointer,
      details: { code: entry.code, subject: entry.subject, qualifier: entry.qualifier ?? null },
    });
  }
  return normalizeDiagnostics([...results, ...collector.finalize()]);
};
