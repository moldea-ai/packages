import { configDefaults, mergeConfig } from 'vitest/config';

import { createTestConfig } from '../../../configs/vitest/test.config.js';

export default mergeConfig(createTestConfig({ suite: 'unit' }), {
  test: {
    exclude: [...configDefaults.exclude, '**/{_archive,_archives,_backup,_backups}/**'],
  },
});
