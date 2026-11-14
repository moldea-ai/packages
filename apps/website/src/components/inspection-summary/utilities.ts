import type { IProjectValidationResult } from '@moldea.ai/core';

import type { IInspectionSummaryKind } from './types.ts';

/** Supplies the executed snapshot's visible summary title. */
export const getInspectionSummaryCopy = (
  result: IProjectValidationResult,
  summary: IInspectionSummaryKind,
): { title: string } =>
  ({
    connected: {
      title: 'Path found',
    },
    broken: {
      title: `${result.diagnostics.length} broken reference`,
    },
    repaired: {
      title: 'Check passes',
    },
    'missing-tool-implementation': {
      title: `${result.diagnostics.length} broken reference`,
    },
  })[summary];
