import type {
  IInspectionJsonValue,
  IInspectionResultView,
} from '@moldea.ai/website-ui/inspection-presentation';
import { z } from 'zod';

// display validation remains closed to the six groups emitted by this build's Core
export const Finding = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(['error', 'warning']),
  group: z.enum(['discovery', 'manifest', 'references', 'agents', 'mirrors', 'integration']),
  path: z.string().nullable(),
  pointer: z.string().nullable().optional(),
  entity: z.record(z.string(), z.json()).nullable().optional(),
  details: z.record(z.string(), z.json()).optional(),
  range: z
    .object({
      start: z.object({ line: z.number().int().positive() }),
      end: z
        .object({
          line: z.number().int().positive(),
          column: z.number().int().positive().optional(),
        })
        .optional(),
    })
    .nullable()
    .optional(),
  accepted: z.boolean().optional(),
  reason: z.string().nullable().optional(),
  subject: z.string().optional(),
  qualifier: z.string().nullable().optional(),
  acceptable: z.boolean().optional(),
});
export type IFinding = z.infer<typeof Finding>;
export interface IExportEvidence {
  path: string;
  symbol?: string;
  relationship?: string;
}
export const Binding = z.object({
  fileCheck: z.literal('passed'),
  relationship: z.string(),
  path: z.string(),
  symbol: z.string().nullable().optional(),
  entity: z.record(z.string(), z.json()).optional(),
  exportCheck: z.enum(['passed', 'failed', 'not-checked']),
  exportNotCheckedReason: z
    .enum([
      'no-symbol',
      'unsupported-file-type',
      'unresolved-exports',
      'unparseable-source',
      'resource-limit',
    ])
    .optional(),
});
export interface INativeFinding {
  record: IInspectionJsonValue;
  display: IFinding;
}
export type IRecordedInspectionView = IInspectionResultView & {
  output: string;
  outputLabel: string;
};
