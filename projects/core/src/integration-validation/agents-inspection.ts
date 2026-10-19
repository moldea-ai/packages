import { parseRepositoryPath } from '@moldea.ai/repository';

import type { IRetainedSource } from '../retained-memory/index.js';

import { parseIntegrationBlock, parseManagedIntegrationRegion } from './parser.js';
import type { IIntegrationInspectionContext } from './types.js';
import { getAbsentKind, getUnreadableLinkState, readRetainedText } from './utilities.js';

const AGENTS_PATH = parseRepositoryPath('/AGENTS.md');

/**
 * Checks root AGENTS.md against its referenced skill installation. A symlinked AGENTS.md whose
 * final target is a readable regular file, inside or outside the repository, is checked on the
 * target text; any other link is reported as unverifiable without reading it.
 * @param context The instruction view, repository reader, ledger, and warning recorder.
 * @returns A promise that settles after at most one integration warning was recorded.
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
export const inspectAgentsIntegration = async (
  context: IIntegrationInspectionContext,
): Promise<void> => {
  const { instructions, ledger, reader, signal } = context;
  const report = (
    code: Parameters<IIntegrationInspectionContext['report']>[0],
    details: Record<string, string>,
  ): void => context.report(code, AGENTS_PATH, details);
  const entry = await instructions.getEntry(AGENTS_PATH);

  if (entry === null) return report('MOLDEA_INTEGRATION_BLOCK_MISSING', { entryKind: 'missing' });
  if (entry.type === 'directory')
    return report('MOLDEA_INTEGRATION_BLOCK_MISSING', { entryKind: 'directory' });

  let load: () => Promise<IRetainedSource> = () => instructions.readSourceFile(AGENTS_PATH);
  let entryDetails: Record<string, string> = { entryKind: 'file' };

  if (entry.type === 'symlink') {
    const resolution = await instructions.resolveLink(AGENTS_PATH);
    const linkState = getUnreadableLinkState(resolution);
    if (linkState !== null || resolution === null)
      return report('MOLDEA_INTEGRATION_UNVERIFIED', {
        entryKind: 'symlink',
        linkState: linkState ?? 'unavailable',
      });
    load = () => instructions.readLinkedSourceFile(AGENTS_PATH);
    entryDetails = { entryKind: 'symlink', linkTarget: resolution.state };
  }

  let document: Awaited<ReturnType<typeof readRetainedText>>;
  try {
    document = await readRetainedText(ledger, load);
  } catch (error) {
    const absentKind = getAbsentKind(error);
    if (absentKind === null) throw error;
    return entry.type === 'symlink'
      ? report('MOLDEA_INTEGRATION_UNVERIFIED', { entryKind: 'symlink', linkState: 'not-file' })
      : report('MOLDEA_INTEGRATION_BLOCK_MISSING', { entryKind: absentKind });
  }
  try {
    if (document.text === null)
      return report('MOLDEA_INTEGRATION_BLOCK_MISSING', {
        ...entryDetails,
        reason: 'invalid-utf8',
      });
    const parsed = parseIntegrationBlock(document.text);
    if (parsed.kind === 'missing')
      return report(
        parsed.reason.startsWith('block-')
          ? 'MOLDEA_INTEGRATION_BLOCK_MISSING'
          : 'MOLDEA_INTEGRATION_SKILL_MISSING',
        { ...entryDetails, reason: parsed.reason },
      );
    const { skillPath } = parsed;
    for (const file of ['SKILL.md', 'scripts/relevance-gate.mjs']) {
      const path = parseRepositoryPath(`/${skillPath}/${file}`);
      const skillEntry = await reader.getEntry(path, signal === undefined ? undefined : { signal });
      if (skillEntry?.type !== 'file')
        return report('MOLDEA_INTEGRATION_SKILL_MISSING', {
          referencedPath: `/${skillPath}`,
          missingFile: path,
          entryKind: skillEntry?.type ?? 'missing',
        });
    }
    const assetPath = parseRepositoryPath(`/${skillPath}/assets/managed-agents-block.md`);
    let asset: Awaited<ReturnType<typeof readRetainedText>>;
    try {
      asset = await readRetainedText(ledger, () => ledger.readSourceFile(assetPath));
    } catch (error) {
      const entryKind = getAbsentKind(error);
      if (entryKind !== null)
        return report('MOLDEA_INTEGRATION_SKILL_MISSING', {
          referencedPath: `/${skillPath}`,
          missingFile: assetPath,
          entryKind,
        });
      throw error;
    }
    try {
      if (asset.text === null)
        return report('MOLDEA_INTEGRATION_BLOCK_STALE', {
          referencedPath: `/${skillPath}`,
          reason: 'invalid-utf8-asset',
        });
      const region = parseManagedIntegrationRegion(document.text)!;
      let occurrences = 0;
      let offset = 0;
      while ((offset = asset.text.indexOf('{{skill-path}}', offset)) !== -1) {
        occurrences++;
        offset += '{{skill-path}}'.length;
      }
      const renderedReservation = (asset.text.length + occurrences * skillPath.length) * 8;
      ledger.reserve(renderedReservation);
      try {
        const expected = asset.text
          .replaceAll('{{skill-path}}', skillPath)
          .replace(/\r\n?/g, '\n')
          .replaceAll('\n', region.lineEnding);
        if (document.text.slice(region.start, region.end) !== expected)
          return report('MOLDEA_INTEGRATION_BLOCK_STALE', { referencedPath: `/${skillPath}` });
      } finally {
        ledger.release(renderedReservation);
      }
    } finally {
      asset.release();
    }
  } finally {
    document.release();
  }
};
