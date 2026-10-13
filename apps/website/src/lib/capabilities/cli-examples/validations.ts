import { assertCapabilityFacts } from '../index.ts';

import { CliEnvelope, type ICliEnvelope } from './types.ts';

/** Validates the command envelope before any command-specific projection. */
export const parseCliExecution = (
  execution: { stdout: string; exitStatus: number },
  command: string,
  cliVersion: string,
): ICliEnvelope => {
  const envelope = CliEnvelope.parse(JSON.parse(execution.stdout));
  assertCapabilityFacts([envelope.command, envelope.cliVersion], [command, cliVersion]);
  if (envelope.status === 'error') {
    assertCapabilityFacts(
      [
        execution.exitStatus === 2 || execution.exitStatus === 3,
        envelope.result,
        envelope.error !== null,
      ],
      [true, null, true],
    );
  } else {
    assertCapabilityFacts(
      [execution.exitStatus, envelope.error, envelope.result !== null],
      [envelope.status === 'valid' ? 0 : 1, null, true],
    );
  }
  if (command !== 'content' && /"content"\s*:/u.test(execution.stdout)) {
    throw new Error('A content-free CLI capability command returned content.');
  }
  return envelope;
};
