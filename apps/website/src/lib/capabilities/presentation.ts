import type { IProjectValidationResult } from '@moldea.ai/core';

import type {
  ICapabilities,
  ICapabilityCase,
  ICapabilityFact,
  ICapabilityOutcome,
} from './types.ts';

const DIAGNOSTIC_TITLES: Record<string, string> = {
  'policy-reference-missing': '1 missing file',
  'policy-reference-directory': 'A folder where a file is required',
  'agent-identity': '1 mismatched agent identity',
  'tool-implementation-missing': '1 missing tool implementation',
  'mirror-stale': '1 stale instruction copy',
  'variable-undeclared': '1 undeclared variable',
  'foundation-missing': 'Project brief not found',
  'decision-cycle': 'Circular replacement links',
  'decision-reference-missing': '1 missing decision',
};
const COMMAND_TITLES: Record<string, string> = {
  'cli-invalid-project': 'Declared export missing',
  'cli-canonical-content': 'One document, ready for your tools',
  'cli-content-refusal': 'Source file outside this command’s scope',
};

/**
 * Orders every executed case once, leading each section with its four featured cases.
 * @throws If a case, section, or featured selection is missing, duplicated, or wrongly grouped.
 */
export const getCapabilityShowcase = (catalog: Pick<ICapabilities, 'groups' | 'cases'>) => {
  const byId = new Map<string, ICapabilityCase>();
  const grouped = new Map(catalog.groups.map((group) => [group.id, [] as ICapabilityCase[]]));
  if (grouped.size !== catalog.groups.length) throw new Error('Repeated capability section.');
  for (const example of catalog.cases) {
    if (byId.has(example.id)) throw new Error(`Repeated capability case: ${example.id}.`);
    const group = grouped.get(example.groupId);
    if (!group) throw new Error(`Unknown capability section: ${example.groupId}.`);
    byId.set(example.id, example);
    group.push(example);
  }
  return catalog.groups.map((group) => {
    const selected = new Set(group.featuredExampleIds);
    if (selected.size !== group.featuredExampleIds.length)
      throw new Error(`Repeated capability illustration for ${group.id}.`);
    if (selected.size !== 4)
      throw new Error('Each capability section requires four featured cases.');
    const featured = group.featuredExampleIds.map((id) => {
      const example = byId.get(id);
      if (!example || example.groupId !== group.id)
        throw new Error(`Missing capability illustration for ${group.id}: ${id}.`);
      return example;
    });
    return {
      group,
      examples: [...featured, ...grouped.get(group.id)!.filter(({ id }) => !selected.has(id))],
    };
  });
};

/** Selects only diagrams whose specific assumptions match the executed case. */
export const getCapabilityVisualFamily = (example: ICapabilityCase) => {
  if (
    [
      'policy-reference-missing',
      'policy-reference-connected',
      'policy-reference-directory',
      'foundation-missing',
      'tool-implementation-missing',
      'skill-implementation-missing',
    ].includes(example.id)
  )
    return 'files';
  if (['mirror-stale', 'variable-undeclared', 'agent-identity'].includes(example.id))
    return 'agents';
  if (
    ['decision-replacement-chain', 'decision-cycle', 'decision-reference-missing'].includes(
      example.id,
    )
  )
    return 'decisions';
  if (example.id === 'snapshot-comparison') return 'records';
  if (example.id === 'normalized-digests') return 'digests';
  if (example.id === 'manifest-change-relevance') return 'scope';
  if (example.result.kind === 'cli') return 'command';
  if (example.result.kind === 'inspection' || example.result.kind === 'reader') return 'operation';
  return 'source';
};

/** Presents native validation without treating accepted warnings or unchecked exports as passes. */
export const getValidationOutcome = (
  result: Pick<IProjectValidationResult, 'valid' | 'diagnostics'> &
    Partial<Pick<IProjectValidationResult, 'acceptedWarningCount' | 'coverageCounts'>>,
): Omit<ICapabilityOutcome, 'description'> => {
  if (!result.valid) {
    return {
      title: `${result.diagnostics.length} diagnostic${result.diagnostics.length === 1 ? '' : 's'}`,
      label: 'Blocking',
      tone: 'danger',
    };
  }
  const warningCount = result.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'warning' && diagnostic.accepted !== true,
  ).length;
  if (warningCount > 0) {
    return {
      title: `${warningCount} warning${warningCount === 1 ? '' : 's'}`,
      label: 'Warning',
      tone: 'warning',
    };
  }
  const accepted = result.acceptedWarningCount ?? 0;
  if (accepted > 0)
    return {
      title: `${accepted} accepted warning${accepted === 1 ? '' : 's'}`,
      label: 'Accepted',
      tone: 'info',
    };
  const notChecked = result.coverageCounts?.exportsNotChecked ?? 0;
  if (notChecked > 0)
    return {
      title: `${notChecked} export check${notChecked === 1 ? '' : 's'} could not run`,
      label: 'Not checked',
      tone: 'neutral',
    };
  return {
    title: 'Declared checks pass',
    label: 'Passed',
    tone: 'success',
  };
};

/** Distinguishes a failed check, absent evidence, and an operation that could not complete. */
export const getCapabilityOutcome = (example: ICapabilityCase): ICapabilityOutcome => {
  const result = example.result;
  const description = example.description;
  if (result.kind === 'validation') {
    const outcome = getValidationOutcome(result);
    return {
      ...outcome,
      description,
      title: !result.valid
        ? (DIAGNOSTIC_TITLES[example.id] ?? outcome.title)
        : outcome.label === 'Passed' && example.id === 'decision-replacement-chain'
          ? 'Decision chain checks pass'
          : outcome.title,
    };
  }
  if (result.kind === 'cli') {
    const warningCount = result.facts.warningCount;
    if (result.status === 'valid' && typeof warningCount === 'number' && warningCount > 0)
      return {
        title: `${warningCount} warning${warningCount === 1 ? '' : 's'}`,
        description,
        label: 'Warning',
        tone: 'warning',
      };
    const accepted = result.facts.acceptedWarningCount;
    if (result.status === 'valid' && typeof accepted === 'number' && accepted > 0)
      return {
        title: `${accepted} accepted warning${accepted === 1 ? '' : 's'}`,
        description,
        label: 'Accepted',
        tone: 'info',
      };
    return {
      title:
        COMMAND_TITLES[example.id] ??
        `Exit ${result.exitStatus}: ${result.status === 'error' ? 'operation refused' : result.status === 'invalid' ? 'invalid project' : 'completed'}`,
      description,
      label:
        result.status === 'error'
          ? 'Refused'
          : result.status === 'invalid'
            ? 'Blocking'
            : example.operation === 'validate'
              ? 'Passed'
              : 'Completed',
      tone:
        result.status === 'error'
          ? 'warning'
          : result.status === 'invalid'
            ? 'danger'
            : example.operation === 'validate'
              ? 'success'
              : 'info',
    };
  }
  if (typeof result.facts.code === 'string')
    return {
      title: result.facts.code === 'ABORTED' ? 'Read cancelled' : 'Operation refused',
      description,
      label: 'Refused',
      tone: 'warning',
    };
  if (example.id === 'inspection-mixed-diagnostics')
    return {
      title: '1 blocking finding and 2 warnings across three pages',
      description,
      label: 'Blocking',
      tone: 'danger',
    };
  return {
    title:
      example.id === 'snapshot-comparison'
        ? 'Changes identified'
        : example.id === 'manifest-change-relevance'
          ? 'Related knowledge identified'
          : example.id === 'normalized-digests'
            ? 'Text changes produce a different fingerprint'
            : 'Recorded facts returned',
    description,
    label: 'Returned',
    tone: 'info',
  };
};

/**
 * Narrows generated fact rows for the page's typed record diagrams.
 * @throws If the diagram facts are not an array of records.
 */
export const getCapabilityFactRows = (fact: ICapabilityFact): Record<string, ICapabilityFact>[] => {
  if (!Array.isArray(fact))
    throw new Error('Capability diagram requires an array of fact records.');
  return fact.map((row) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row))
      throw new Error('Capability diagram requires an object for each fact row.');
    return row;
  });
};
