import { createLibraryConfig } from '../../configs/vite/library.config.js';

export default createLibraryConfig({
  entry: {
    adapter: 'src/adapter/index.ts',
    format: 'src/format/index.ts',
    index: 'src/index.ts',
    node: 'src/node/index.ts',
    'node-runner': 'src/node-inspection/runner.ts',
    'analysis-worker': 'src/node-inspection/analysis-worker.ts',
  },
  externalPackages: [
    '@moldea.ai/repository',
    'error-message-utils',
    'yaml',
    'node:buffer',
    'node:child_process',
    'node:crypto',
    'node:url',
    'node:process',
    'node:worker_threads',
    'node:v8',
  ],
  platform: 'environment-neutral',
  rootDirectory: import.meta.dirname,
});
