import { parseRepositoryPath, RepositorySourceException } from '@moldea.ai/repository';

import type { ICoreResourceLimits } from '../contracts/index.js';
import { createCoreDiagnosticCollector } from '../diagnostic-utilities/index.js';
import type { ICoreDiagnostic, ICoreWarningCode } from '../diagnostics/index.js';
import type { IRepositoryInspectionReader } from '../repository-inspection-session/index.js';
import { getRetainedMemory, type IRetainedMemory } from '../retained-memory/index.js';

import { parseIntegrationBlock, parseManagedIntegrationRegion } from './parser.js';

const AGENTS_PATH = parseRepositoryPath('/AGENTS.md');

/**
 * Reads bounded untrusted text with a reservation for decoding and temporary string copies.
 * @returns Decoded text or null for invalid UTF-8, with its reservation-release operation.
 * @throws
 * - ENTRY_NOT_FOUND: The requested repository entry was not found.
 * - ENTRY_NOT_FILE: The requested repository entry is not a file.
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
 * - ABORTED: The Core operation was aborted.
 * - ABORTED: The repository operation was aborted.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
 * - INVALID_SOURCE_DATA: The repository source returned invalid data.
 */
const readText = async (
  ledger: IRetainedMemory,
  path: ReturnType<typeof parseRepositoryPath>,
): Promise<{ text: string | null; release: () => void }> => {
  const source = await ledger.readSourceFile(path);
  const reservation = source.bytes.byteLength * 8;
  let isReserved = false;
  try {
    ledger.reserve(reservation);
    isReserved = true;
    let text: string | null;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(source.bytes);
    } catch {
      text = null;
    }
    return { text, release: () => ledger.release(reservation) };
  } catch (error) {
    if (isReserved) ledger.release(reservation);
    throw error;
  } finally {
    source.release();
  }
};

/** Distinguishes missing and non-regular files without an extra entry lookup or following symlinks. */
const getAbsentKind = (error: unknown): 'missing' | 'non-regular' | null =>
  error instanceof RepositorySourceException
    ? error.code === 'ENTRY_NOT_FOUND'
      ? 'missing'
      : error.code === 'ENTRY_NOT_FILE'
        ? 'non-regular'
        : null
    : null;

/**
 * Checks the root integration against its installed asset with at most two reads and two lookups.
 * @returns Completed content-free integration warnings, never an execution or runtime-wiring claim.
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
export const inspectCodingAgentIntegration = async (
  reader: IRepositoryInspectionReader,
  limits: ICoreResourceLimits,
  signal?: AbortSignal,
): Promise<readonly ICoreDiagnostic[]> => {
  const ledger = getRetainedMemory(reader);
  const collector = createCoreDiagnosticCollector(limits, 'validate-project');
  const report = (
    code: ICoreWarningCode,
    details: Record<string, string>,
  ): readonly ICoreDiagnostic[] => {
    collector.add({
      code,
      path: AGENTS_PATH,
      subject: AGENTS_PATH,
      qualifier: null,
      entity: { integrationPath: AGENTS_PATH },
      details,
    });
    return collector.finalize();
  };
  let document: Awaited<ReturnType<typeof readText>>;
  try {
    document = await readText(ledger, AGENTS_PATH);
  } catch (error) {
    const entryKind = getAbsentKind(error);
    if (entryKind !== null) return report('MOLDEA_INTEGRATION_BLOCK_MISSING', { entryKind });
    throw error;
  }
  try {
    if (document.text === null)
      return report('MOLDEA_INTEGRATION_BLOCK_MISSING', {
        entryKind: 'file',
        reason: 'invalid-utf8',
      });
    const parsed = parseIntegrationBlock(document.text);
    if (parsed.kind === 'missing')
      return report(
        parsed.reason.startsWith('block-')
          ? 'MOLDEA_INTEGRATION_BLOCK_MISSING'
          : 'MOLDEA_INTEGRATION_SKILL_MISSING',
        { entryKind: 'file', reason: parsed.reason },
      );
    const { skillPath } = parsed;
    for (const file of ['SKILL.md', 'scripts/relevance-gate.mjs']) {
      const path = parseRepositoryPath(`/${skillPath}/${file}`);
      const entry = await reader.getEntry(path, signal === undefined ? undefined : { signal });
      if (entry?.type !== 'file')
        return report('MOLDEA_INTEGRATION_SKILL_MISSING', {
          referencedPath: `/${skillPath}`,
          missingFile: path,
          entryKind: entry?.type ?? 'missing',
        });
    }
    const assetPath = parseRepositoryPath(`/${skillPath}/assets/managed-agents-block.md`);
    let asset: Awaited<ReturnType<typeof readText>>;
    try {
      asset = await readText(ledger, assetPath);
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
      return collector.finalize();
    } finally {
      asset.release();
    }
  } finally {
    document.release();
  }
};
