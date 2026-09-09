import { parse } from 'yaml';
import { z } from 'zod';

import type { ICapabilityCase } from '../../../lib/capabilities/index.ts';

const VariableManifest = z.object({
  agents: z.record(z.string(), z.object({ variables: z.record(z.string(), z.unknown()) })),
});

/**
 * Projects the diagnosed instruction line and actual declaration names, not a replacement example.
 * @throws If the recorded diagnostic and its synthetic source no longer agree.
 */
export const getVariableIllustration = (example: ICapabilityCase) => {
  const diagnostic =
    example.result.kind === 'validation'
      ? example.result.diagnostics.find(({ code }) => code === 'MOLDEA_VARIABLE_UNDECLARED')
      : undefined;
  const instruction = example.files.find(({ path }) => path === diagnostic?.path);
  const manifest = example.files.find(({ path }) => path === '/moldea/moldea.yaml');
  const variableId = diagnostic?.entity?.variableId;
  const agentId = diagnostic?.entity?.agentId;
  if (!instruction || !manifest || !variableId || !agentId || !diagnostic?.range)
    throw new Error('Variable illustration requires its diagnostic, instruction, and manifest.');
  const declarations = VariableManifest.parse(parse(manifest.content) as unknown).agents[agentId];
  const token = `{{${variableId}}}`;
  const line = instruction.content.split('\n')[diagnostic.range.start.line - 1];
  const parts = line?.split(token);
  if (!declarations || Object.hasOwn(declarations.variables, variableId) || parts?.length !== 2)
    throw new Error('Variable illustration does not match its executed sources.');
  return {
    instruction,
    manifest,
    token,
    variableId,
    before: parts[0],
    after: parts[1],
    names: Object.keys(declarations.variables),
  };
};

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
