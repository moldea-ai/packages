import { configDefaults, mergeConfig } from 'vitest/config';

import { createTestConfig } from '../../../configs/vitest/test.config.js';

export default mergeConfig(
  createTestConfig({
    include: ['scripts/**/*.test-integration.ts', 'src/**/*.test-integration.ts'],
    suite: 'integration',
  }),
  {
    test: {
      exclude: [...configDefaults.exclude, '**/{_archive,_archives,_backup,_backups}/**'],
    },
  },
);
