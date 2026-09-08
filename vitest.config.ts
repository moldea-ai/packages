import { configDefaults, mergeConfig } from 'vitest/config';

import { createTestConfig } from './configs/vitest/test.config.js';

export default mergeConfig(
  createTestConfig({
    include: [
      '.github/workflows/*.test-unit.ts',
      'configs/**/*.test-unit.ts',
      'scripts/**/*.test-unit.ts',
    ],
    suite: 'unit',
  }),
  { test: { exclude: [...configDefaults.exclude, '**/{_archive,_archives,_backup,_backups}/**'] } },
);
