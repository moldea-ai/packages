import type { ICapabilityCase } from '../../../lib/capabilities/index.ts';

/**
 * Isolates this example's changed return window; this is not a general-purpose text diff.
 * @throws If the sources differ in anything other than their single return-window instruction.
 */
export const getMirrorIllustration = (example: ICapabilityCase) => {
  const original = example.files.find(({ path }) => path.endsWith('/instruction.md'));
  const copy = example.files.find(({ path }) => path === '/instructions/support.md');
  const originalLines = original?.content.split('\n') ?? [];
  const copyLines = copy?.content.split('\n') ?? [];
  const differences = originalLines.flatMap((line, index) =>
    line === copyLines[index] ? [] : [{ original: line, copy: copyLines[index] }],
  );
  const originalWindow = /^(.*?)(\d+) days(.*)$/u.exec(differences[0]?.original ?? '');
  const copyWindow = /^(.*?)(\d+) days(.*)$/u.exec(differences[0]?.copy ?? '');
  if (
    !original ||
    !copy ||
    originalLines.length !== copyLines.length ||
    differences.length !== 1 ||
    !originalWindow ||
    !copyWindow ||
    originalWindow[1] !== copyWindow[1] ||
    originalWindow[3] !== copyWindow[3]
  )
    throw new Error('Mirror illustration requires a single changed return window.');
  return {
    original,
    copy,
    before: originalWindow[1],
    originalDays: originalWindow[2],
    copyDays: copyWindow[2],
    after: originalWindow[3],
  };
};

/**
 * Connects the expected identity to the actual first instruction line.
 * @throws If the executed identity diagnostic or its source is missing.
 */
export const getIdentityIllustration = (example: ICapabilityCase) => {
  const diagnostic =
    example.result.kind === 'validation'
      ? example.result.diagnostics.find(({ code }) => code === 'MOLDEA_AGENT_IDENTITY_INVALID')
      : undefined;
  const instruction = example.files.find(({ path }) => path === diagnostic?.path);
  const manifest = example.files.find(({ path }) => path === '/moldea/moldea.yaml');
  const agentId = diagnostic?.entity?.agentId;
  const line = instruction?.content.split('\n')[0];
  if (!instruction || !manifest || !agentId || !line)
    throw new Error('Identity illustration requires its diagnostic and source files.');
  return { instruction, manifest, agentId, line };
};
