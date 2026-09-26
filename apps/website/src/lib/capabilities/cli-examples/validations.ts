import { assertCapabilityFacts, type ICapabilityFact } from '../index.ts';

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

/**
 * Rejects displayed JSON fields that are absent from or differ from the executed CLI response.
 * @throws
 * - A CLI result excerpt does not match the executed response.
 */
export const assertCliResultExcerpt = (source: unknown, excerpt: ICapabilityFact): void => {
  const matches = (actual: unknown, selected: ICapabilityFact): boolean => {
    if (Array.isArray(selected))
      return (
        Array.isArray(actual) &&
        selected.length <= actual.length &&
        selected.every((item, index) => matches(actual[index], item))
      );
    if (selected !== null && typeof selected === 'object')
      return (
        actual !== null &&
        typeof actual === 'object' &&
        !Array.isArray(actual) &&
        Object.entries(selected).every(
          ([key, item]) => Object.hasOwn(actual, key) && matches(Reflect.get(actual, key), item),
        )
      );
    return Object.is(actual, selected);
  };
  if (!matches(source, excerpt))
    throw new Error('A CLI result excerpt does not match the executed response.');
};
