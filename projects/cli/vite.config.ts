import { mergeConfig } from 'vite';

import { createLibraryConfig } from '../../configs/vite/library.config.js';

const libraryConfig = createLibraryConfig({
  entry: {
    moldea: 'src/bin/index.ts',
  },
  externalPackages: [
    '@moldea.ai/core',
    '@moldea.ai/repository',
    '@moldea.ai/repository-fs',
    'jg-crypto',
    'jg-exception',
    'jg-git-commands',
    'jg-process',
    'jg-utilities',
  ],
  platform: 'node',
  rootDirectory: import.meta.dirname,
});

export default mergeConfig(libraryConfig, {
  build: {
    rolldownOptions: {
      output: {
        banner: '#!/usr/bin/env node',
      },
    },
  },
});
