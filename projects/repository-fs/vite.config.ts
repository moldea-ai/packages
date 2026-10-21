import { createLibraryConfig } from '../../configs/vite/library.config.js';

export default createLibraryConfig({
  entry: {
    index: 'src/index.ts',
  },
  externalPackages: ['@moldea.ai/repository', 'jg-crypto', 'jg-utilities'],
  platform: 'node',
  rootDirectory: import.meta.dirname,
});
