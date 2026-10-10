import type {
  ICapabilityRuntimeTarget,
  ICapabilityCase,
  ICapabilityFile,
} from '../../../lib/capabilities/index.ts';

// a small set of stories leads with a specific existing pattern witness
const LEADING_PATTERNS: Record<string, string> = {
  'cloudflare-agents': 'directly-exported-think-class',
  'eve-workspace-peer': 'workspace-subagent-reference',
  'openai-agent-handoffs': 'direct-agent-handoff',
  'vercel-deferred-tool': 'direct-function-tool-bindings',
};
const COMPANION_PATTERNS: Record<string, { id: string; label: string }> = {
  'cloudflare-agents': {
    id: 'directly-exported-ai-chat-agent-class',
    label: 'AIChatAgent generation',
  },
  'cloudflare-think-configured-context': {
    id: 'closed-think-tools-map',
    label: 'Deferred tools',
  },
  'langgraph-workflows': {
    id: 'direct-compiled-state-graph',
    label: 'State graph',
  },
};

/** Keeps a contiguous, bounded source window around the existing independent witness. */
const previewSource = (file: ICapabilityFile, marker: string, label: string) => {
  const offset = file.content.indexOf(marker);
  if (offset < 0) throw new Error('Runtime preview omits its required source witness.');
  const lines = file.content.split('\n');
  const markerLine = file.content.slice(0, offset).split('\n').length - 1;
  const start = Math.max(0, Math.min(markerLine - 3, lines.length - 16));
  const end = Math.min(start + 16, lines.length);
  return {
    file,
    label,
    content: lines.slice(start, end).join('\n').trimEnd(),
    isExcerpt: file.isExcerpt || start > 0 || end < lines.length,
  };
};

/**
 * Selects the source that demonstrates the named story, independently of warning locations.
 * @throws If a selected source witness or fallback source is missing from the executed inputs.
 */
export const getRuntimeSourcePreviews = (
  example: ICapabilityCase,
  catalog: { runtimeTargets: Pick<ICapabilityRuntimeTarget, 'patterns'>[] },
) => {
  if (example.result.kind !== 'adapter')
    throw new Error('Runtime preview requires an adapter result.');
  const proofs = catalog.runtimeTargets.flatMap(({ patterns }) =>
    patterns.flatMap(({ id, proofs }) =>
      proofs.filter(({ caseId }) => caseId === example.id).map(({ source }) => ({ id, source })),
    ),
  );
  const leadingPattern = LEADING_PATTERNS[example.id];
  const leading = leadingPattern ? proofs.find(({ id }) => id === leadingPattern) : proofs[0];
  if (leadingPattern && !leading)
    throw new Error('Runtime preview requires its selected pattern witness.');
  const runtimePath = example.result.evidence.find(({ kind }) => kind === 'runtime-pattern')
    ?.references[0]?.path;
  const fallbackPath = runtimePath ?? example.result.diagnostics[0]?.path;
  const fallback =
    fallbackPath !== undefined
      ? example.files.find(({ path }) => path === fallbackPath)
      : example.files.find(
          ({ representation, path }) => representation === 'source' && /\.[cm]?tsx?$/u.test(path),
        );
  const fromWitness = (source: { path: string; contains: string }, label: string) => {
    const file = example.files.find(({ path }) => path === source.path);
    if (!file) throw new Error('Runtime preview requires its witnessed input file.');
    return previewSource(file, source.contains, label);
  };
  const previews = [];
  if (leading) previews.push(fromWitness(leading.source, 'Inspected source'));
  else {
    if (!fallback) throw new Error('Runtime preview requires an executed source.');
    previews.push(previewSource(fallback, '', 'Inspected source'));
  }
  const companion = COMPANION_PATTERNS[example.id];
  if (companion) {
    const proof = proofs.find(({ id }) => id === companion.id);
    if (!proof) throw new Error('Runtime preview requires its companion pattern witness.');
    previews.push(fromWitness(proof.source, companion.label));
  }
  return previews;
};
