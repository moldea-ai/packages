import { createLibraryConfig } from '../../configs/vite/library.config.js';

export default createLibraryConfig({
  entry: {
    index: 'src/index.ts',
    memory: 'src/memory.ts',
    testing: 'src/testing/index.ts',
  },
  externalPackages: ['jg-exception', 'jg-utilities'],
  platform: 'environment-neutral',
  rootDirectory: import.meta.dirname,
});
