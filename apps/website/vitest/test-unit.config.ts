import { createTestConfig } from '../../../configs/vitest/test.config.js';

export default createTestConfig({
  include: ['scripts/**/*.test-unit.ts', 'src/**/*.test-unit.ts'],
  suite: 'unit',
});
