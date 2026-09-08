import type { IInspectionSnapshot } from './types.ts';

const project = '# Refund policy\n\nRefunds require manager approval.\n';
const source = 'export const requiresManagerApproval = true;\n';
const originalManifest =
  'version: 1\ncontext:\n  /moldea/project.md:\n    bindings:\n      - path: /src/refund-policy.ts\n';

// synthetic, bounded snapshots; displayed source and validated source have the same owner
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
    explanation: 'The file moves into payments, but the connection still points to its old path.',
    manifest: originalManifest,
    project,
    sourcePath: '/src/payments/refund-policy.ts',
    source,
  },
  {
    id: 'repaired',
    label: '3. Connection updated',
    explanation: 'A developer updates the declared path. The structural check passes again.',
    manifest: originalManifest.replace('/src/refund-policy.ts', '/src/payments/refund-policy.ts'),
    project,
    sourcePath: '/src/payments/refund-policy.ts',
    source,
  },
];
