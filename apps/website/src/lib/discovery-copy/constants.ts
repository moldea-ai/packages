import type { IDiscoveryCopy } from './types.ts';

// authored labels are validated against every generated public package
export const DISCOVERY_COPY: IDiscoveryCopy = {
  packages: {
    '@moldea.ai/cli': {
      name: 'Check a local repository',
      description:
        'Run structural checks from your terminal. The usual starting point once a repository has adopted moldea.',
    },
    '@moldea.ai/core': {
      name: 'Build checks into your tools',
      description:
        'Interpret project structure and validate declared connections through a source-neutral TypeScript API.',
    },
    '@moldea.ai/repository': {
      name: 'Supply repository content',
      description:
        'Use shared read-only contracts and an in-memory reader for content your application already has.',
    },
    '@moldea.ai/repository-fs': {
      name: 'Read a local filesystem',
      description:
        'Give Core a coherent, read-only view of an explicitly selected repository directory.',
    },
  },
};
