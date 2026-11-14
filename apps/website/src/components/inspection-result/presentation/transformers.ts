import type { IProjectValidationResult } from '@moldea.ai/core';
import type {
  IInspectionBindingView,
  IInspectionEvidence,
  IInspectionFindingView,
  IInspectionResultView,
} from '@moldea.ai/website-ui/inspection-presentation';
import { withBase } from '@moldea.ai/website-ui/site';

import {
  createRecordedOutput,
  getCapabilityOutcome,
  getValidationOutcome,
  type ICapabilityCase,
  type ICapabilityFile,
  type IRecordedOutput,
} from '../../../lib/capabilities/index.ts';
import { DIAGNOSTIC_GROUP_FRAGMENTS } from './constants.ts';
import type { IExportEvidence, INativeFinding } from './types.ts';
import {
  asRecord,
  bindingView,
  decodeInspectionField,
  findingFacts,
  findingTarget,
  isMissingTarget,
  readFindings,
  readValidationFindings,
  sourceEvidence,
  warningAcceptance,
} from './utilities.ts';

/** Collects only native existing-file coverage, retaining its source-page order. */
const readBindings = (output: IRecordedOutput, isCli: boolean): IInspectionBindingView[] => {
  const bindings: IInspectionBindingView[] = [];
  for (const response of output.responses) {
    const responseRecord = asRecord(response);
    const body = isCli ? asRecord(responseRecord?.['result']) : responseRecord;
    const coverage = body?.['coverage'];
    if (Array.isArray(coverage))
      for (const record of coverage) {
        const binding = bindingView(record);
        if (binding) bindings.push(binding);
      }
    const records = asRecord(body?.['page'])?.['records'];
    if (!Array.isArray(records)) continue;
    for (const candidate of records) {
      const record = asRecord(candidate),
        item = asRecord(record?.['item']);
      const native =
        record?.['kind'] === 'coverage'
          ? record
          : item?.['kind'] === 'coverage'
            ? item['coverage']
            : undefined;
      if (native !== undefined) {
        const binding = bindingView(native);
        if (binding) bindings.push(binding);
      }
    }
  }
  return bindings;
};

/** Enriches one proven CLI export failure without assigning coverage across ambiguous findings. */
const exportEvidence = (
  example: ICapabilityCase,
  findings: INativeFinding[],
  bindings: IInspectionBindingView[],
): IExportEvidence | undefined => {
  if (
    example.result.kind !== 'cli' ||
    findings.length !== 1 ||
    findings[0]?.display.code !== 'MOLDEA_REFERENCE_EXPORT_MISSING'
  )
    return undefined;
  const failed = bindings.filter((binding) => binding.outcome === 'failed');
  if (failed.length === 1) return failed[0];
  if (bindings.length > 0) return undefined;
  // this selected native coverage fact is also retained by the existing CLI example adapter
  const selected = asRecord(example.result.facts['coverage']);
  return selected?.['exportCheck'] === 'failed' && typeof selected['path'] === 'string'
    ? {
        path: selected['path'],
        ...(typeof selected['symbol'] === 'string' ? { symbol: selected['symbol'] } : {}),
      }
    : undefined;
};

/** Combines display facts with truthful captured source while leaving the native record untouched.
 * @throws
 * - INVALID_BASE_PATH: The website base path contains unsupported URL characters.
 */
const findingView = (
  { record, display: finding }: INativeFinding,
  index: number,
  files: ICapabilityFile[],
  isCli: boolean,
  basePath: string,
  exportTarget?: IExportEvidence,
): IInspectionFindingView => {
  const target = findingTarget(finding, exportTarget);
  const missingFile = finding.details?.['missingFile'];
  const referencedPath =
    finding.code === 'MOLDEA_INTEGRATION_SKILL_MISSING' && typeof missingFile === 'string'
      ? missingFile
      : target.referencedPath;
  const captured = files.filter(
    (file) => isCli || file.path === finding.path || file.path === referencedPath,
  );
  const declarationFile = captured.find(
    (file) => file.path === finding.path && file.representation === 'source',
  );
  const declaration = declarationFile ? sourceEvidence(declarationFile, finding, true) : undefined;
  const evidence: IInspectionEvidence[] = captured
    .filter((file) => file !== declarationFile)
    .map((file) => sourceEvidence(file, finding, false));
  if (referencedPath !== undefined && !captured.some((file) => file.path === referencedPath))
    evidence.push({
      path: referencedPath,
      label: 'Referenced file',
      language: 'text',
      isMissing: isMissingTarget(finding),
    });
  return {
    id: `finding-${index + 1}`,
    kind: 'structural',
    message: finding.message,
    code: finding.code,
    severity: finding.severity,
    group: finding.group,
    record,
    ...(finding.path === null ? {} : { path: finding.path }),
    field: decodeInspectionField(finding.pointer),
    target: target.target,
    ...(target.related ? { related: target.related } : {}),
    ...(declaration ? { declaration } : {}),
    evidence,
    facts: findingFacts(finding, target.consumed),
    guidanceHref: withBase(
      `/packages/core/diagnostics/#${DIAGNOSTIC_GROUP_FRAGMENTS[finding.group]}`,
      basePath,
    ),
    ...(finding.accepted === undefined ? {} : { accepted: finding.accepted }),
    ...(finding.reason == null ? {} : { reason: finding.reason }),
    ...(warningAcceptance(finding) === undefined ? {} : { acceptance: warningAcceptance(finding) }),
  };
};

/** Adapts recorded capability results; Astro callers supply their configured public base path.
 * @throws
 * - INVALID_BASE_PATH: The website base path contains unsupported URL characters.
 * - If a captured diagnostic does not satisfy the presentation contract
 * - The recorded validation diagnostics do not match the displayed result.
 */
export const getCapabilityInspectionView = (
  example: ICapabilityCase,
  basePath = '/',
): IInspectionResultView => {
  const outcome = getCapabilityOutcome(example),
    result = example.result,
    findings = readFindings(example);
  const bindings = readBindings(example.output, result.kind === 'cli');
  const exportTarget = exportEvidence(example, findings, bindings);
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
      findingView(finding, index, example.files, result.kind === 'cli', basePath, exportTarget),
    ),
    bindings,
    ...(typeof code === 'string' ? { code } : {}),
    ...(findings.length === 0 ? { limitation: example.limitation } : {}),
  };
};

/** Presents the homepage's executed Core snapshots with their complete native diagnostics.
 * @throws
 * - INVALID_BASE_PATH: The website base path contains unsupported URL characters.
 * - If a captured diagnostic does not satisfy the presentation contract
 * - The recorded validation diagnostics do not match the displayed result.
 */
export const getProjectInspectionView = (
  result: IProjectValidationResult,
  title: string,
  files: ICapabilityFile[] = [],
  basePath = '/',
): IInspectionResultView => {
  const { label, tone } = getValidationOutcome(result),
    output = createRecordedOutput([result]);
  return {
    title,
    label,
    tone,
    findings: readValidationFindings(output, result.diagnostics.length).map((finding, index) =>
      findingView(finding, index, files, false, basePath),
    ),
    bindings: readBindings(output, false),
  };
};
