// @vitest-environment node
import { expect, test } from 'vitest';

import { checkUpstreamTarget } from './runner.ts';
import { PINNED_UPSTREAM_TARGETS } from './targets.ts';

// three subprocesses can each use the 120-second cap; allow time to remove the consumer
const UPSTREAM_TARGET_TEST_TIMEOUT_MS = 480_000;

test(
  'checks real current SDK exports and controlled request preparation',
  async () => {
    const target = PINNED_UPSTREAM_TARGETS.find(
      ({ family, fixture }) => family === 'openai' && fixture === 'current',
    );

    if (target === undefined) {
      throw new TypeError('The current OpenAI upstream target is required.');
    }

    const result = await checkUpstreamTarget(target);

    expect(result).toStrictEqual({ ...target, requestPreparationChecked: true });
  },
  UPSTREAM_TARGET_TEST_TIMEOUT_MS,
);
