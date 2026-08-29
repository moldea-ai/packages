import { defineConfig } from 'vite';

import { createLibraryConfig } from '../../configs/vite/library.config.js';

const libraryConfig = createLibraryConfig({
  entry: {
    'evaluation-replay': 'src/evaluation-replay/index.ts',
    index: 'src/index.ts',
    markdown: 'src/markdown/index.ts',
    search: 'src/search/index.ts',
    site: 'src/site/index.ts',
    theme: 'src/theme/index.ts',
  },
  externalPackages: ['error-message-utils'],
  platform: 'node',
  rootDirectory: import.meta.dirname,
});

export default defineConfig({
  ...libraryConfig,
  resolve: {
    conditions: ['node'],
  },
});
