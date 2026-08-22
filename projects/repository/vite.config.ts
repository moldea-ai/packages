import { createLibraryConfig } from '../../configs/vite/library.config.js';

export default createLibraryConfig({
  entry: {
    index: 'src/index.ts',
    memory: 'src/memory.ts',
    testing: 'src/testing/index.ts',
  },
  externalPackages: ['error-message-utils', 'vitest', 'web-utils-kit'],
  platform: 'environment-neutral',
  rootDirectory: import.meta.dirname,
});
