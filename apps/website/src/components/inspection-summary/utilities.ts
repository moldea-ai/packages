import type { IInspectionResultExcerpt } from '../../lib/inspection-example/index.ts';

import type { IInspectionSummaryKind } from './types.ts';

/** Supplies identical outcome copy to the visible summary and its dialog's accessible name. */
export const getInspectionSummaryCopy = (
  result: IInspectionResultExcerpt,
  summary: IInspectionSummaryKind,
): { title: string; description: string } =>
  ({
    connected: {
      title: 'Path found',
      description: 'The project note points to an existing file.',
    },
    broken: {
      title: `${result.diagnostics.length} broken reference`,
      description: 'The project note points to a missing file.',
    },
    repaired: {
      title: 'Check passes',
      description: 'The updated reference points to the moved file.',
    },
    'missing-tool-implementation': {
      title: `${result.diagnostics.length} broken reference`,
      description: 'The delivery-status tool points to a missing file.',
    },
  })[summary];
