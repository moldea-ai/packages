import type {
  ICapabilities,
  ICapabilityCase,
  ICapabilityFact,
  ICapabilityOutcome,
  ICapabilityResult,
} from './types.ts';

const DIAGNOSTIC_TITLES: Record<string, string> = {
  'manifest-unknown-property': 'Unknown field: agent',
  'policy-reference-directory': 'A directory is not a source file',
  'variable-undeclared': '1 undeclared variable',
  'mirror-stale': '1 stale instruction copy',
  'decision-cycle': '2 decisions form a cycle',
};

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
          title: `${result.evidence.length} evidence records`,
          description,
          label: 'Inspected',
          tone: 'info',
        }
      : { title: 'Structure checks pass', description, label: 'Valid', tone: 'success' };
  }
  if (result.kind === 'cli') {
    return {
      title: `Exit ${result.exitStatus}: ${result.status === 'error' ? 'operation refused' : result.status === 'invalid' ? 'invalid project' : 'completed'}`,
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
  return { title: 'Recorded facts returned', description, label: 'Returned', tone: 'info' };
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

/**
 * Finds the exact executed source files used by a featured illustration.
 * @throws If a source-backed example lacks its selected illustration files.
 */
export const getCapabilityVisualFiles = (example: ICapabilityCase): ICapabilityCase['files'] => {
  const selected =
    example.id === 'mirror-stale'
      ? example.files.filter(
          ({ path }) => path.endsWith('/instruction.md') || path === '/instructions/support.md',
        )
      : example.id === 'variable-undeclared'
        ? example.files.filter(({ path }) => path.endsWith('/instruction.md'))
        : example.groupId === 'decisions'
          ? example.files.filter(({ path }) => path.startsWith('/moldea/decisions/'))
          : example.files.filter(({ path }) => path === '/moldea/moldea.yaml');
  if (selected.length === 0 && example.files.length > 0)
    throw new Error(`Capability illustration has no selected source for ${example.id}.`);
  return selected;
};
