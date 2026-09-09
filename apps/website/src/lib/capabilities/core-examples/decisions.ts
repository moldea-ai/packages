import type { ICoreDiagnosticCode } from '@moldea.ai/core';
import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

import { createCoreEntries } from './constants.ts';
import type { ICoreExampleDefinition } from './types.ts';

const originalId = '1767225600000';
const replacementId = '1767312000000';
const originalPath = `/moldea/decisions/${originalId}-return-window.md`;
const replacementPath = `/moldea/decisions/${replacementId}-extend-return-window.md`;
const originalContent =
  '---\nstatus: accepted\ncreatedAt: "2026-01-01T00:00:00.000Z"\n---\nAccept returns within 30 days of delivery.\n';

/** Builds a replacement decision with an explicit historical reference. */
const replacement = (supersedes: string): IMemoryRepositoryEntry => ({
  path: replacementPath,
  type: 'file',
  content: `---\nstatus: accepted\ncreatedAt: "2026-01-02T00:00:00.000Z"\nsupersedes: ["${supersedes}"]\n---\nExtend the return window to 60 days.\n`,
});

/** Defines an individual document parser example. */
const documentCase = (
  id: string,
  title: string,
  description: string,
  content: string,
  expectedCodes: ICoreDiagnosticCode[],
  path = originalPath,
): ICoreExampleDefinition => ({
  id,
  title,
  description,
  expectedCodes,
  groupId: 'decisions',
  operation: 'parseDecision',
  entries: [],
  text: { path, content },
});

/** Defines a repository-level history check, separate from document parsing. */
const graphCase = (
  id: string,
  title: string,
  description: string,
  decisions: IMemoryRepositoryEntry[],
  expectedCodes: ICoreDiagnosticCode[],
  manifest = 'version: 1\n',
): ICoreExampleDefinition => ({
  id,
  title,
  description,
  expectedCodes,
  groupId: 'decisions',
  operation: 'validateProject',
  entries: createCoreEntries(manifest, decisions),
});

// decisions demonstrate document validity, graph consistency, and active relationships
export const DECISION_EXAMPLES: ICoreExampleDefinition[] = [
  documentCase(
    'decision-frontmatter-invalid',
    'The frontmatter is not a mapping',
    'Structured decision fields cannot be supplied as a YAML sequence.',
    '---\n[]\n---\nAccept returns within 30 days.\n',
    ['MOLDEA_DECISION_FRONTMATTER_INVALID'],
  ),
  documentCase(
    'decision-valid',
    'A decision with a stable identity',
    'The filename, timestamp, status, and body satisfy the document contract.',
    originalContent,
    [],
  ),
  documentCase(
    'decision-filename',
    'The decision has no timestamp ID',
    'Decision filenames carry the identity used by historical references.',
    originalContent,
    ['MOLDEA_DECISION_FILENAME_INVALID'],
    '/moldea/decisions/return-window.md',
  ),
  documentCase(
    'decision-frontmatter',
    'A decision without frontmatter',
    'A prose note alone does not declare a decision status and creation time.',
    'Accept returns within 30 days.\n',
    ['MOLDEA_DECISION_FRONTMATTER_MISSING'],
  ),
  documentCase(
    'decision-timestamp',
    'Two different creation times',
    'The filename timestamp and frontmatter timestamp must agree.',
    originalContent.replace('2026-01-01', '2026-01-02'),
    ['MOLDEA_DECISION_TIMESTAMP_MISMATCH'],
  ),
  documentCase(
    'decision-created-at',
    'A malformed creation time',
    'Creation time must use the format’s timestamp representation.',
    originalContent.replace('2026-01-01T00:00:00.000Z', 'yesterday'),
    ['MOLDEA_DECISION_CREATED_AT_INVALID'],
  ),
  documentCase(
    'decision-body',
    'A status without a decision',
    'The Markdown body cannot be empty.',
    originalContent.slice(0, originalContent.lastIndexOf('---') + 3),
    ['MOLDEA_DECISION_BODY_EMPTY'],
  ),
  graphCase(
    'decision-replacement-chain',
    'The new decision replaces the old one',
    'The 60-day decision correctly replaces the earlier 30-day decision.',
    [
      {
        path: originalPath,
        type: 'file',
        content: originalContent.replace('accepted', 'superseded'),
      },
      replacement(originalId),
    ],
    [],
  ),
  graphCase(
    'decision-reference-missing',
    'The earlier decision is missing',
    'The new decision replaces a record that cannot be found.',
    [replacement(originalId)],
    ['MOLDEA_DECISION_REFERENCE_MISSING'],
  ),
  graphCase(
    'decision-self-reference',
    'A decision replaces itself',
    'Self-supersession is not a valid history relationship.',
    [replacement(replacementId)],
    ['MOLDEA_DECISION_SELF_SUPERSESSION'],
  ),
  graphCase(
    'decision-status-mismatch',
    'Both decisions remain accepted',
    'An active supersession must agree with the predecessor’s status.',
    [{ path: originalPath, type: 'file', content: originalContent }, replacement(originalId)],
    ['MOLDEA_DECISION_SUPERSESSION_STATUS_INVALID'],
  ),
  graphCase(
    'decision-orphan',
    'Superseded, but by which decision?',
    'A superseded record requires an active incoming replacement relationship.',
    [
      {
        path: originalPath,
        type: 'file',
        content: originalContent.replace('accepted', 'superseded'),
      },
    ],
    ['MOLDEA_DECISION_SUPERSEDED_ORPHAN'],
  ),
  graphCase(
    'decision-cycle',
    'Two decisions claim to replace each other',
    'Each proposal names the other as the decision it replaces.',
    [
      {
        path: originalPath,
        type: 'file',
        content: originalContent.replace(
          'status: accepted',
          `status: proposed\nsupersedes: ["${replacementId}"]`,
        ),
      },
      {
        ...replacement(originalId),
        type: 'file',
        content: `---\nstatus: proposed\ncreatedAt: "2026-01-02T00:00:00.000Z"\nsupersedes: ["${originalId}"]\n---\nExtend the return window to 60 days.\n`,
      },
    ],
    ['MOLDEA_DECISION_SUPERSESSION_CYCLE', 'MOLDEA_DECISION_SUPERSESSION_CYCLE'],
  ),
  graphCase(
    'decision-duplicate-id',
    'Two files claim the same decision ID',
    'Changing the filename suffix does not create a new decision identity.',
    [
      { path: originalPath, type: 'file', content: originalContent },
      {
        path: `/moldea/decisions/${originalId}-another-policy.md`,
        type: 'file',
        content: originalContent,
      },
    ],
    ['MOLDEA_DECISION_ID_DUPLICATE', 'MOLDEA_DECISION_ID_DUPLICATE'],
  ),
  ...(['accepted', 'proposed'] as const).map((status) =>
    graphCase(
      `decision-relationship-${status}`,
      status === 'accepted'
        ? 'An accepted decision informs the source'
        : 'A source relationship points to a proposal',
      'Manifest decision relationships identify accepted decisions, not merely existing documents.',
      [{ path: originalPath, type: 'file', content: originalContent.replace('accepted', status) }],
      status === 'accepted' ? [] : ['MOLDEA_DECISION_RELATIONSHIP_INACTIVE'],
      `version: 1\ndecisions:\n  ${originalPath}:\n    affectedBy: [/src/returns/**]\n`,
    ),
  ),
];
