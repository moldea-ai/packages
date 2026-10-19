import { parseRepositoryPath, type IRepositoryLinkResolution } from '@moldea.ai/repository';

import type { IRetainedSource } from '../retained-memory/index.js';

import { hasAgentsImport } from './parser.js';
import type {
  IAgentsInstructionTarget,
  IInstructionLinkState,
  IIntegrationInspectionContext,
} from './types.js';
import { getAbsentKind, getUnreadableLinkState, readRetainedText } from './utilities.js';

const AGENTS_PATH = parseRepositoryPath('/AGENTS.md');
const CLAUDE_PATH = parseRepositoryPath('/CLAUDE.md');
const NESTED_CLAUDE_PATH = parseRepositoryPath('/.claude/CLAUDE.md');
const LOCAL_CLAUDE_PATH = parseRepositoryPath('/CLAUDE.local.md');

// whether one Claude Code instruction file loads AGENTS.md
type IClaudeAssessment =
  | { readonly kind: 'absent' | 'loads' }
  | { readonly entryKind: string; readonly kind: 'not-loading' }
  | { readonly kind: 'unverified'; readonly linkState: IInstructionLinkState };

type IClaudePath = typeof CLAUDE_PATH;

/** Recognizes a link between a Claude file and AGENTS.md without reading either file. */
const isLinkedToAgents = (
  path: IClaudePath,
  resolution: IRepositoryLinkResolution | null,
  agents: IAgentsInstructionTarget,
): boolean => {
  const agentsResolution = agents.kind === 'link' ? agents.resolution : null;

  // AGENTS.md itself links to this Claude file
  if (agentsResolution?.state === 'inside' && agentsResolution.targetPath === path) return true;
  if (resolution === null || (resolution.state !== 'inside' && resolution.state !== 'outside'))
    return false;
  if (agents.kind === 'file')
    return resolution.state === 'inside' && resolution.targetPath === AGENTS_PATH;
  return (
    (agentsResolution?.state === 'inside' || agentsResolution?.state === 'outside') &&
    agentsResolution.targetIdentity === resolution.targetIdentity
  );
};

/**
 * Determines whether one Claude Code file loads AGENTS.md through an import line, a link to the
 * same final target, or AGENTS.md linking to it. A linked Claude file with a regular-file target
 * is checked for an import line as if the file were at the link's own location.
 * @returns The assessment, reading at most the file or its link target once.
 * @throws
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
 * - ABORTED: The Core operation was aborted.
 * - ABORTED: The repository operation was aborted.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
 * - INVALID_SOURCE_DATA: The repository source returned invalid data.
 */
const assessClaudeFile = async (
  context: IIntegrationInspectionContext,
  path: IClaudePath,
  agents: IAgentsInstructionTarget,
): Promise<IClaudeAssessment> => {
  const { instructions, ledger } = context;
  const entry = await instructions.getEntry(path);

  if (entry === null) return { kind: 'absent' };
  if (isLinkedToAgents(path, null, agents)) return { kind: 'loads' };
  if (entry.type === 'directory') return { entryKind: 'directory', kind: 'not-loading' };

  let load: () => Promise<IRetainedSource> = () => instructions.readSourceFile(path);

  if (entry.type === 'symlink') {
    const resolution = await instructions.resolveLink(path);
    if (isLinkedToAgents(path, resolution, agents)) return { kind: 'loads' };
    const linkState = getUnreadableLinkState(resolution);
    if (linkState !== null) return { kind: 'unverified', linkState };
    load = () => instructions.readLinkedSourceFile(path);
  }

  let document: Awaited<ReturnType<typeof readRetainedText>>;
  try {
    document = await readRetainedText(ledger, load);
  } catch (error) {
    if (getAbsentKind(error) === null) throw error;
    return entry.type === 'symlink'
      ? { kind: 'unverified', linkState: 'not-file' }
      : { kind: 'absent' };
  }
  try {
    return document.text !== null && hasAgentsImport(document.text, path === NESTED_CLAUDE_PATH)
      ? { kind: 'loads' }
      : { entryKind: entry.type, kind: 'not-loading' };
  } finally {
    document.release();
  }
};

/**
 * Checks whether Claude Code loads AGENTS.md. When `/CLAUDE.md` or `/.claude/CLAUDE.md` exists,
 * only those shared files count; `/CLAUDE.local.md` counts only when neither exists. At most one
 * Claude warning is recorded: unverifiable for the first unverifiable counted file when none
 * loads AGENTS.md, otherwise a missing import for the governing file.
 * @param context The instruction view, ledger, and warning recorder.
 * @param agents What root AGENTS.md is, as the AGENTS.md check observed it.
 * @returns A promise that settles after at most one Claude warning was recorded.
 * @throws
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
 * - ABORTED: The Core operation was aborted.
 * - ABORTED: The repository operation was aborted.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
 * - INVALID_SOURCE_DATA: The repository source returned invalid data.
 */
export const inspectClaudeIntegration = async (
  context: IIntegrationInspectionContext,
  agents: IAgentsInstructionTarget,
): Promise<void> => {
  const counted: { path: IClaudePath; assessment: IClaudeAssessment }[] = [];

  for (const path of [CLAUDE_PATH, NESTED_CLAUDE_PATH]) {
    const assessment = await assessClaudeFile(context, path, agents);
    if (assessment.kind === 'loads') return;
    if (assessment.kind !== 'absent') counted.push({ assessment, path });
  }

  if (counted.length === 0) {
    const assessment = await assessClaudeFile(context, LOCAL_CLAUDE_PATH, agents);
    if (assessment.kind === 'absent' || assessment.kind === 'loads') return;
    counted.push({ assessment, path: LOCAL_CLAUDE_PATH });
  }

  const unverifiable = counted.find(({ assessment }) => assessment.kind === 'unverified');

  if (unverifiable?.assessment.kind === 'unverified') {
    context.report('MOLDEA_INTEGRATION_UNVERIFIED', unverifiable.path, {
      entryKind: 'symlink',
      linkState: unverifiable.assessment.linkState,
    });
    return;
  }

  const governing = counted[0];

  if (governing?.assessment.kind === 'not-loading') {
    context.report('MOLDEA_INTEGRATION_CLAUDE_IMPORT_MISSING', governing.path, {
      entryKind: governing.assessment.entryKind,
    });
  }
};
