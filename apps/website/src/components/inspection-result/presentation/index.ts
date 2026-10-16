import type { IProjectValidationResult } from '@moldea.ai/core';
import type {
  IInspectionEvidence,
  IInspectionFindingView,
  IInspectionResultView,
} from '@moldea.ai/website-ui/inspection-presentation';
import { z } from 'zod';

import {
  createRecordedOutput,
  getCapabilityOutcome,
  getValidationOutcome,
  type ICapabilityCase,
  type ICapabilityFact,
  type ICapabilityFile,
  type IRecordedOutput,
} from '../../../lib/capabilities/index.ts';

// executed examples always retain their captured response
type IRecordedInspectionView = IInspectionResultView & { output: string; outputLabel: string };

// only finding fields used by presentation are interpreted; output remains complete
const Finding = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(['error', 'warning']),
  group: z.enum(['discovery', 'manifest', 'references', 'agents', 'mirrors', 'integration']),
  path: z.string().nullable(),
  pointer: z.string().nullable().optional(),
  accepted: z.boolean().optional(),
  reason: z.string().nullable().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
type IFinding = z.infer<typeof Finding>;

// these diagnostics locate the issue in the referenced target, not its declaration
const TARGET_DIAGNOSTIC_CODES = new Set([
  'MOLDEA_REFERENCE_MISSING',
  'MOLDEA_REFERENCE_NOT_FILE',
  'MOLDEA_REFERENCE_SYMLINK',
  'MOLDEA_REFERENCE_EXPORT_MISSING',
  'MOLDEA_DECISION_REFERENCE_MISSING',
  'MOLDEA_RUNTIME_GUIDANCE_MISSING',
  'MOLDEA_TOOL_IMPLEMENTATION_MISSING',
  'MOLDEA_SKILL_IMPLEMENTATION_MISSING',
  'MOLDEA_INTEGRATION_SKILL_MISSING',
]);
const MISSING_TARGET_CODES = new Set([
  'MOLDEA_REFERENCE_MISSING',
  'MOLDEA_DECISION_REFERENCE_MISSING',
  'MOLDEA_RUNTIME_GUIDANCE_MISSING',
  'MOLDEA_TOOL_IMPLEMENTATION_MISSING',
  'MOLDEA_SKILL_IMPLEMENTATION_MISSING',
  'MOLDEA_INTEGRATION_SKILL_MISSING',
]);

const asRecord = (
  candidate: ICapabilityFact | undefined,
): Record<string, ICapabilityFact> | null =>
  candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate
    : null;

/** Reads diagnostic records from captured native CLI or Core inspection pages. */
const readFindings = (example: ICapabilityCase): IFinding[] => {
  if (example.result.kind === 'validation')
    return example.result.diagnostics.map((diagnostic) => Finding.parse(diagnostic));
  const findings: IFinding[] = [];
  for (const response of example.output.responses) {
    const record = asRecord(response);
    const body = example.result.kind === 'cli' ? asRecord(record?.['result']) : record;
    const records = asRecord(body?.['page'])?.['records'];
    if (!Array.isArray(records)) continue;
    for (const entry of records) {
      const item = asRecord(entry);
      const coreItem = asRecord(item?.['item']);
      if (item?.['kind'] === 'diagnostic') findings.push(Finding.parse(item));
      else if (coreItem?.['kind'] === 'diagnostic')
        findings.push(Finding.parse(coreItem['diagnostic']));
    }
  }
  return findings;
};

/** Selects source-backed evidence and keeps an absent referenced target content-free. */
const findingView = (
  finding: IFinding,
  index: number,
  files: ICapabilityFile[],
  isCli = false,
  exportTarget?: string,
): IInspectionFindingView => {
  const declaredTarget = finding.details?.['referencedPath'];
  const referencedPath =
    finding.code === 'MOLDEA_INTEGRATION_SKILL_MISSING' &&
    typeof finding.details?.['missingFile'] === 'string'
      ? finding.details['missingFile']
      : typeof declaredTarget === 'string'
        ? declaredTarget
        : exportTarget;
  const isMissing =
    MISSING_TARGET_CODES.has(finding.code) &&
    finding.details?.['actualType'] === undefined &&
    (finding.details?.['entryKind'] === undefined || finding.details['entryKind'] === 'missing');
  const affectedPath = TARGET_DIAGNOSTIC_CODES.has(finding.code) ? referencedPath : finding.path;
  const issueLabel =
    finding.code === 'MOLDEA_REFERENCE_EXPORT_MISSING'
      ? 'Missing export'
      : isMissing
        ? 'Missing target'
        : finding.severity === 'error'
          ? 'Needs correction'
          : 'Needs attention';
  const evidence: IInspectionEvidence[] = files
    .filter((file) => isCli || file.path === finding.path || file.path === referencedPath)
    .map((file) => ({
      path: file.path,
      content: file.content,
      language: file.language,
      isExcerpt: file.isExcerpt,
      ...(file.path === affectedPath ? { issueLabel } : {}),
      ...(file.representation === 'source'
        ? {}
        : {
            label:
              file.representation === 'bytes'
                ? 'Byte representation'
                : 'JSON string representation',
          }),
    }));
  if (typeof referencedPath === 'string' && !evidence.some((file) => file.path === referencedPath))
    evidence.push({
      path: referencedPath,
      label: 'Referenced target',
      language: 'text',
      ...(referencedPath === affectedPath ? { issueLabel } : {}),
      isMissing,
    });
  return {
    id: `finding-${index + 1}`,
    title: finding.message,
    message: finding.message,
    code: finding.code,
    severity: finding.severity,
    group: finding.group,
    ...(finding.path === null ? {} : { path: finding.path }),
    ...(finding.pointer == null ? {} : { pointer: finding.pointer }),
    ...(finding.accepted === undefined ? {} : { accepted: finding.accepted }),
    ...(finding.reason == null ? {} : { reason: finding.reason }),
    evidence,
  };
};

/** Formats complete output without moving process context into native envelopes. */
const outputView = (
  output: IRecordedOutput,
): Pick<IRecordedInspectionView, 'output' | 'outputLabel' | 'redactions'> => ({
  output: JSON.stringify(
    output.responses.length === 1 ? output.responses[0] : output.responses,
    null,
    2,
  ),
  outputLabel: output.kind === 'execution-facts' ? 'Execution facts' : 'JSON',
  redactions: output.redactions.map(
    ({ responseIndex, pointer, reason }) => `Response ${responseIndex + 1}: ${pointer} (${reason})`,
  ),
});

/** Adapts actual capability outcomes and diagnostics to the official inspection surfaces. */
export const getCapabilityInspectionView = (example: ICapabilityCase): IRecordedInspectionView => {
  const outcome = getCapabilityOutcome(example);
  const result = example.result;
  const findings = readFindings(example);
  const coverage = result.kind === 'cli' ? asRecord(result.facts['coverage']) : null;
  // the renamed-export example retains its one failed native coverage record separately
  const exportTarget =
    findings.length === 1 &&
    findings[0]?.code === 'MOLDEA_REFERENCE_EXPORT_MISSING' &&
    coverage?.['exportCheck'] === 'failed' &&
    typeof coverage['path'] === 'string'
      ? coverage['path']
      : undefined;
  // a refusal has no findings, so its native code is the result's code
  const refusal =
    result.kind === 'cli'
      ? asRecord(result.facts['error'])
      : result.kind === 'validation'
        ? null
        : result.facts;
  const code = outcome.label === 'Refused' ? refusal?.['code'] : undefined;
  return {
    title: outcome.title,
    label: outcome.label,
    tone: outcome.tone,
    findings: findings.map((finding, index) =>
      findingView(finding, index, example.files, result.kind === 'cli', exportTarget),
    ),
    ...(typeof code === 'string' ? { code } : {}),
    ...outputView(example.output),
    ...(result.kind === 'cli' ? { command: result.command, exitStatus: result.exitStatus } : {}),
    limitation: example.limitation,
  };
};

/** Presents a complete Core validation from the homepage's executed source snapshots. */
export const getProjectInspectionView = (
  result: IProjectValidationResult,
  title: string,
  files: ICapabilityFile[] = [],
): IRecordedInspectionView => {
  const { label, tone } = getValidationOutcome(result);
  return {
    title,
    label,
    tone,
    findings: result.diagnostics.map((diagnostic, index) =>
      findingView(Finding.parse(diagnostic), index, files),
    ),
    ...outputView(createRecordedOutput([result])),
    limitation: 'This checks structure and declared references, not application behavior.',
  };
};
