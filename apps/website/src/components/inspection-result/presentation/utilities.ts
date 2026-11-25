import { formatRepositoryPath } from '@moldea.ai/website-ui/code-presentation';
import type {
  IInspectionBindingView,
  IInspectionEvidence,
  IInspectionJsonValue,
  IInspectionMetadataIcon,
  IInspectionMetadataItem,
} from '@moldea.ai/website-ui/inspection-presentation';

import type {
  ICapabilityCase,
  ICapabilityFact,
  ICapabilityFile,
  IRecordedOutput,
} from '../../../lib/capabilities/index.ts';
import {
  DETAIL_FACTS,
  ENTITY_FACTS,
  LABELLED_VALUE_FIELDS,
  MISSING_TARGET_CODES,
  NOT_CHECKED_MESSAGES,
  RELATIONSHIP_ICON_ROLES,
  VALUE_LABELS,
} from './constants.ts';
import {
  Binding,
  Finding,
  type IExportEvidence,
  type IFinding,
  type INativeFinding,
} from './types.ts';

/** Decodes native JSON Pointer coordinates without inventing a field for a missing pointer. */
export const decodeInspectionField = (pointer: string | null | undefined): string[] =>
  pointer == null
    ? []
    : pointer === ''
      ? ['Document root']
      : (pointer.startsWith('/') ? pointer.slice(1) : pointer)
          .split('/')
          .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'));

/** Narrows captured JSON objects without interpreting their additional fields. */
export const asRecord = (
  candidate: ICapabilityFact | undefined,
): Record<string, ICapabilityFact> | null =>
  candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate
    : null;

/** Keeps the native record intact while validating only the fields used by display. */
const nativeFinding = (record: ICapabilityFact): INativeFinding => ({
  record,
  display: Finding.parse(record),
});

/** Reads diagnostics from the actual response pages, including native CLI record fields. */
export const readFindings = (example: ICapabilityCase): INativeFinding[] => {
  if (example.result.kind === 'validation') {
    // the producer's display projection must still fail the build for a newly introduced group
    example.result.diagnostics.forEach((diagnostic) => Finding.parse(diagnostic));
    return readValidationFindings(example.output, example.result.diagnostics.length);
  }
  const findings: INativeFinding[] = [];
  for (const response of example.output.responses) {
    const responseRecord = asRecord(response);
    const body =
      example.result.kind === 'cli' ? asRecord(responseRecord?.['result']) : responseRecord;
    const records = asRecord(body?.['page'])?.['records'];
    if (!Array.isArray(records)) continue;
    for (const entry of records) {
      const record = asRecord(entry);
      const item = asRecord(record?.['item']);
      if (record?.['kind'] === 'diagnostic') findings.push(nativeFinding(record));
      else if (item?.['kind'] === 'diagnostic' && item['diagnostic'] !== undefined)
        findings.push(nativeFinding(item['diagnostic']));
    }
  }
  return findings;
};

/** Reads complete Core validation diagnostics instead of serializing the display projection. */
export const readValidationFindings = (
  output: IRecordedOutput,
  diagnosticCount: number,
): INativeFinding[] => {
  const findings = output.responses.flatMap((response) => {
    const diagnostics = asRecord(response)?.['diagnostics'];
    return Array.isArray(diagnostics) ? diagnostics.map(nativeFinding) : [];
  });
  if (findings.length !== diagnosticCount)
    throw new Error('The recorded validation diagnostics do not match the displayed result.');
  return findings;
};

/** Gives unknown fact keys the same readable labels as the platform. */
export const humanizeField = (key: string): string => {
  const words = key
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[_-]+/gu, ' ')
    .trim();
  return words.length > 0 ? words[0].toUpperCase() + words.slice(1) : key;
};

/** Formats retained values without treating free text or paths as classified values. */
export const formatFact = (value: IInspectionJsonValue, key?: string): string => {
  if (value === null) return 'None';
  if (typeof value !== 'string') return JSON.stringify(value);
  if (value === '') return '""';
  if (key === undefined || !LABELLED_VALUE_FIELDS.has(key)) return value;
  const label = Object.hasOwn(VALUE_LABELS, value) ? VALUE_LABELS[value] : humanizeField(value);
  return label === value ? value : `${label} (${value})`;
};

/** Selects the affected declaration and tracks exactly which facts its rows already show. */
export const findingTarget = (finding: IFinding, exportTarget?: IExportEvidence) => {
  const details = finding.details ?? {},
    entity = finding.entity ?? {};
  const string = (record: Record<string, IInspectionJsonValue>, key: string) =>
    typeof record[key] === 'string' ? record[key] : undefined;
  const referencedPath = string(details, 'referencedPath') ?? exportTarget?.path;
  const row = (
    label: string,
    value: string,
    icon: IInspectionMetadataIcon,
  ): IInspectionMetadataItem => ({ label, value, icon });
  if (referencedPath !== undefined) {
    const relationship = string(details, 'relationship') ?? exportTarget?.relationship;
    const symbol = string(details, 'symbol') ?? exportTarget?.symbol;
    const icon = RELATIONSHIP_ICON_ROLES.get(relationship ?? '') ?? 'file';
    return {
      target: row(
        relationship
          ? Object.hasOwn(VALUE_LABELS, relationship)
            ? VALUE_LABELS[relationship]
            : humanizeField(relationship)
          : 'Referenced file',
        formatRepositoryPath(referencedPath),
        icon,
      ),
      related: symbol ? row('Export', symbol, 'export') : undefined,
      consumed: new Set(['detail:referencedPath', 'detail:symbol', 'detail:relationship']),
      referencedPath,
    };
  }
  const impact = string(details, 'impactPath') ?? string(details, 'pattern');
  if (impact !== undefined)
    return {
      target: row('Declared impact scope', impact, 'scope'),
      consumed: new Set([
        string(details, 'impactPath') === undefined ? 'detail:pattern' : 'detail:impactPath',
      ]),
    };
  const mirror = string(details, 'mirrorPath');
  if (mirror !== undefined)
    return {
      target: row('Mirror file', formatRepositoryPath(mirror), 'mirror'),
      consumed: new Set(['detail:mirrorPath']),
    };
  const integration = string(entity, 'integrationPath');
  if (integration !== undefined)
    return {
      target: row('Coding-agent integration', formatRepositoryPath(integration), 'integration'),
      consumed: new Set(['entity:integrationPath']),
    };
  const decision = string(entity, 'decisionId');
  if (decision !== undefined) {
    const referencedDecision = string(details, 'referencedDecisionId');
    return {
      target: row('Decision', decision, 'decision'),
      related: referencedDecision
        ? row('Referenced decision', referencedDecision, 'decision')
        : undefined,
      consumed: new Set(['entity:decisionId', 'detail:referencedDecisionId']),
    };
  }
  const capability = string(entity, 'capabilityId');
  if (capability !== undefined)
    return {
      target: row(
        `${entity['capabilityKind'] === 'tool' ? 'Tool' : entity['capabilityKind'] === 'skill' ? 'Skill' : 'Capability'} implementation`,
        capability,
        'capability',
      ),
      consumed: new Set(['entity:capabilityId', 'entity:capabilityKind']),
    };
  const agent = string(entity, 'agentId');
  if (agent !== undefined)
    return {
      target: row('Registered agent', agent, 'agent'),
      consumed: new Set(['entity:agentId']),
    };
  const context = string(entity, 'contextPath');
  if (context !== undefined)
    return {
      target: row('Context document', formatRepositoryPath(context), 'context'),
      consumed: new Set(['entity:contextPath']),
    };
  return {
    target: row(
      finding.path ? 'Project declaration' : 'Project repository declaration',
      finding.path ? formatRepositoryPath(finding.path) : 'Location unavailable',
      'declaration',
    ),
    consumed: new Set<string>(),
  };
};

/** Keeps remaining entity and detail facts in their native order, without duplicate target rows. */
export const findingFacts = (finding: IFinding, consumed: Set<string>): IInspectionMetadataItem[] =>
  [
    { kind: 'entity', values: finding.entity ?? {}, labels: ENTITY_FACTS },
    { kind: 'detail', values: finding.details ?? {}, labels: DETAIL_FACTS },
  ].flatMap(({ kind, values, labels }) =>
    Object.entries(values).flatMap(([key, value]) =>
      consumed.has(`${kind}:${key}`)
        ? []
        : [
            {
              ...(Object.hasOwn(labels, key)
                ? labels[key]
                : { label: humanizeField(key), icon: 'tag' as const }),
              value: formatFact(value, key),
            },
          ],
    ),
  );

/** Constructs the native warning identity with an intentionally blank required reason. */
export const warningAcceptance = (finding: IFinding): string | undefined =>
  finding.severity !== 'warning' ||
  finding.accepted ||
  finding.acceptable !== true ||
  finding.subject === undefined
    ? undefined
    : [
        'acceptedWarnings:',
        `  - code: ${JSON.stringify(finding.code)}`,
        `    subject: ${JSON.stringify(finding.subject)}`,
        `    qualifier: ${JSON.stringify(finding.qualifier ?? null)}`,
        '    reason:',
        '    # Required: explain why this warning is accepted.',
      ].join('\n');

/** Trims blank edges from captured prefixes and highlights only reported lines that are present. */
export const sourceEvidence = (
  file: ICapabilityFile,
  finding: IFinding,
  declaration: boolean,
): IInspectionEvidence => {
  const label =
    file.representation === 'bytes'
      ? 'Byte representation'
      : file.representation === 'json-string'
        ? 'JSON string representation'
        : declaration
          ? 'Declared in'
          : 'Referenced file';
  if (file.representation !== 'source')
    return {
      path: file.path,
      label,
      language: file.language,
      content: file.content,
      isExcerpt: file.isExcerpt,
    };
  const lines = file.content.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
  let start = 0,
    end = lines.length;
  while (start < end && lines[start].trim() === '') start++;
  while (end > start && lines[end - 1].trim() === '') end--;
  const startLine = start < end ? start + 1 : 1,
    lastLine = start < end ? end : 0;
  const range = declaration ? finding.range : null;
  const firstHighlight = Math.max(startLine, range?.start.line ?? Infinity);
  // an exclusive end at the next line's first column leaves that line outside the finding
  const reportedEndLine = range?.end
    ? range.end.line - Number(range.end.column === 1 && range.end.line > range.start.line)
    : (range?.start.line ?? -Infinity);
  const lastHighlight = Math.min(lastLine, reportedEndLine);
  const highlightedLines =
    firstHighlight <= lastHighlight
      ? Array.from(
          { length: lastHighlight - firstHighlight + 1 },
          (_, index) => firstHighlight + index,
        )
      : [];
  return {
    path: file.path,
    label,
    language: file.language,
    content: lines.slice(start, end).join('\n'),
    isExcerpt: file.isExcerpt,
    startingLineNumber: startLine,
    highlightedLines,
    ...(range && highlightedLines.length === 0
      ? { notice: 'The reported lines are outside this captured excerpt.' }
      : {}),
  };
};

/** Distinguishes a proven missing target from evidence the example simply did not capture. */
export const isMissingTarget = (finding: IFinding): boolean =>
  MISSING_TARGET_CODES.has(finding.code) &&
  finding.details?.['actualType'] === undefined &&
  (finding.details?.['entryKind'] === undefined || finding.details['entryKind'] === 'missing');

/** Projects a retained, existing-file coverage record without inventing an export check. */
export const bindingView = (candidate: ICapabilityFact): IInspectionBindingView | null => {
  const candidateRecord = asRecord(candidate);
  if (!candidateRecord || candidateRecord['fileCheck'] !== 'passed') return null;
  const record = Binding.parse(candidateRecord);
  const entity = asRecord(record['entity']);
  const ownerKeys = [
    ['agentId', 'Agent', 'agent'],
    ['contextPath', 'Context', 'context'],
    ['decisionId', 'Decision', 'decision'],
  ] as const;
  const owner = ownerKeys
    .flatMap(([key, label, icon]) =>
      typeof entity?.[key] === 'string'
        ? [
            {
              label,
              value: icon === 'context' ? formatRepositoryPath(entity[key]) : entity[key],
              icon,
            },
          ]
        : [],
    )
    .at(0);
  const reason = record['exportNotCheckedReason'];
  return {
    relationship: record['relationship'],
    path: record['path'],
    outcome: record['exportCheck'],
    ...(typeof record['symbol'] === 'string' ? { symbol: record['symbol'] } : {}),
    ...(owner ? { owner } : {}),
    ...(record['exportCheck'] === 'not-checked' &&
    typeof reason === 'string' &&
    Object.hasOwn(NOT_CHECKED_MESSAGES, reason)
      ? { reason: NOT_CHECKED_MESSAGES[reason] }
      : {}),
  };
};
