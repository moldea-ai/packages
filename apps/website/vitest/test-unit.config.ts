import { configDefaults, mergeConfig } from 'vitest/config';

import { createTestConfig } from '../../../configs/vitest/test.config.js';

export default mergeConfig(
  createTestConfig({
    include: ['scripts/**/*.test-unit.ts', 'src/**/*.test-unit.ts'],
    suite: 'unit',
  }),
  {
    test: {
      exclude: [...configDefaults.exclude, '**/{_archive,_archives,_backup,_backups}/**'],
    },
  },
);
