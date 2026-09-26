import type {
  ICapabilities,
  ICapabilityCase,
  ICapabilityFact,
  ICapabilityOutcome,
  ICapabilityResult,
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
  'openai-loader-disconnected': 'Instruction loader not connected',
};
const COMMAND_TITLES: Record<string, string> = {
  'cli-invalid-project': 'Broken reference caught by validation',
  'cli-canonical-content': 'One document, ready for your tools',
  'cli-content-refusal': 'Source file outside this command’s scope',
};

/**
 * Resolves the page's selected illustrations in display order for rendering and discovery.
 * @throws If a section selects a missing, repeated, or incorrectly grouped case.
 */
export const getCapabilityShowcase = (catalog: Pick<ICapabilities, 'groups' | 'cases'>) =>
  catalog.groups.map((group) => {
    const examples = group.exampleIds.map((exampleId, index) => {
      const example = catalog.cases.find(({ id }) => id === exampleId);
      if (!example || example.groupId !== group.id)
        throw new Error(`Missing capability illustration for ${group.id}: ${exampleId}.`);
      if (group.exampleIds.indexOf(exampleId) !== index)
        throw new Error(`Repeated capability illustration for ${group.id}: ${exampleId}.`);
      return example;
    });
    return { group, examples };
  });

/** Distinguishes a failed check, absent evidence, and an operation that could not complete. */
export const getCapabilityOutcome = (
  example: ICapabilityCase,
  catalog: Pick<ICapabilities, 'runtimeTargets'>,
): ICapabilityOutcome => {
  const result = example.result;
  const description = example.description;
  if (result.kind === 'validation' || result.kind === 'adapter') {
    if (!result.valid) {
      return {
        title:
          DIAGNOSTIC_TITLES[example.id] ??
          `${result.diagnostics.length} diagnostic${result.diagnostics.length === 1 ? '' : 's'}`,
        description,
        label: 'Invalid',
        tone: 'danger',
      };
    }
    const warningCount = result.diagnostics.filter(({ severity }) => severity === 'warning').length;
    if (warningCount > 0) {
      return {
        title: `${warningCount} runtime relationship${warningCount === 1 ? '' : 's'} unverified`,
        description,
        label: 'Warnings',
        tone: 'warning',
      };
    }
    const hasAbsentEvidence =
      result.kind === 'adapter' &&
      (catalog.runtimeTargets.some(({ patterns }) =>
        patterns.some(({ proofs }) =>
          proofs.some((proof) => proof.caseId === example.id && proof.witness.kind === 'absence'),
        ),
      ) ||
        (example.id === 'vercel-dynamic-preparation' &&
          !result.evidence.some(
            ({ agentId, kind }) => agentId === 'support' && kind === 'instruction-loader',
          )));
    if (hasAbsentEvidence)
      return {
        title: 'Some connections are not established',
        description,
        label: 'Not established',
        tone: 'warning',
      };
    return result.kind === 'adapter'
      ? {
          title:
            example.id === 'openai-responses'
              ? 'Instruction and tool connections found'
              : `${result.evidence.length} source facts found`,
          description,
          label: 'Inspected',
          tone: 'info',
        }
      : {
          title:
            example.id === 'decision-replacement-chain'
              ? 'Decision chain checks pass'
              : 'Structure checks pass',
          description,
          label: 'Valid',
          tone: 'success',
        };
  }
  if (result.kind === 'cli') {
    const warningCount = result.facts.warningCount;
    if (result.status === 'valid' && typeof warningCount === 'number' && warningCount > 0)
      return {
        title: `${warningCount} runtime relationship${warningCount === 1 ? '' : 's'} unverified`,
        description,
        label: 'Warnings',
        tone: 'warning',
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
            ? 'Invalid'
            : 'Completed',
      tone: result.status === 'error' ? 'warning' : result.status === 'invalid' ? 'danger' : 'info',
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
      title: '1 warning and 1 error across two pages',
      description,
      label: 'Mixed results',
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

/** Selects a bounded result excerpt without inventing or changing public-result facts. */
export const getCapabilityResultExcerpt = (result: ICapabilityResult): unknown => {
  if (result.kind === 'validation') return { valid: result.valid, diagnostics: result.diagnostics };
  if (result.kind === 'adapter')
    return {
      valid: result.valid,
      diagnostics: result.diagnostics,
      evidenceCount: result.evidence.length,
      evidenceExcerpt: result.evidence
        .slice(0, 4)
        .map(({ kind, agentId, runtimeName, references }) => ({
          kind,
          agentId,
          runtimeName,
          references,
        })),
    };
  return result.kind === 'cli'
    ? {
        schemaVersion: result.schemaVersion,
        status: result.status,
        exitStatus: result.exitStatus,
        result: result.facts,
      }
    : result.facts;
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
