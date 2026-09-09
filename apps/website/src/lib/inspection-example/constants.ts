import type { IInspectionSnapshot } from './types.ts';

const project = '# Refund policy\n\nRefunds require manager approval.\n';
const source = `export const reviewRefund = (hasManagerApproval: boolean) => {
  return hasManagerApproval ? 'approved' : 'pending-approval';
};
`;
const originalManifest =
  'version: 1\ncontext:\n  /moldea/project.md:\n    bindings:\n      - path: /src/refund-policy.ts\n';

// synthetic, bounded snapshots shared by the preview and reference-check sequence
export const INSPECTION_SNAPSHOTS: IInspectionSnapshot[] = [
  {
    id: 'connected',
    label: '1. Connected',
    explanation: 'The project note declares a connection to a source file. That file exists.',
    manifest: originalManifest,
    project,
    sourcePath: '/src/refund-policy.ts',
    source,
  },
  {
    id: 'broken',
    label: '2. File moved',
    explanation: 'The file moves. The reference still points to the old location.',
    manifest: originalManifest,
    project,
    sourcePath: '/src/payments/refund-policy.ts',
    source,
  },
  {
    id: 'repaired',
    label: '3. Reference updated',
    explanation: 'A developer updates the reference to the new location.',
    manifest: originalManifest.replace('/src/refund-policy.ts', '/src/payments/refund-policy.ts'),
    project,
    sourcePath: '/src/payments/refund-policy.ts',
    source,
  },
];
