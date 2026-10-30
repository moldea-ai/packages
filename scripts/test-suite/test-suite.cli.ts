import { extractMessage } from 'jg-exception';
import { createShutdownSignal } from 'jg-process';

import { parseTestSuiteArguments, runTestSuite } from '#test-suite/index';

const shutdown = createShutdownSignal();
try {
  process.exitCode = await runTestSuite(
    parseTestSuiteArguments(process.argv.slice(2)),
    shutdown.signal,
  );
  process.exitCode = shutdown.exitCode() ?? process.exitCode;
} catch (error) {
  process.stderr.write(`${extractMessage(error)}\n`);
  process.exitCode = shutdown.exitCode() ?? 1;
} finally {
  shutdown.dispose();
}
