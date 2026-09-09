import { z } from 'zod';

import type { ICapabilityCase } from '../../../lib/capabilities/index.ts';

const DigestFacts = z.object({
  originalDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  normalizedCopyDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  changedDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  inputs: z.tuple([z.string(), z.string(), z.string()]),
});

/**
 * Projects the executed return-window inputs and compares their full content digests.
 * @throws If the example lacks its exact input excerpts or digest facts.
 */
export const getDigestIllustration = (example: ICapabilityCase) => {
  if (example.result.kind !== 'inspection')
    throw new Error('Digest illustration requires an inspection result.');
  const facts = DigestFacts.parse(example.result.facts);
  const digests = [facts.originalDigest, facts.normalizedCopyDigest, facts.changedDigest];
  const labels = ['Original text', 'Same text, different line endings', 'Edited text'];
  return facts.inputs.map((content, index) => {
    const line = content.split(/\r?\n/u).find((entry) => /\b\d+ days\b/u.test(entry));
    const match = line ? /^(.*?)(\d+) days(.*)$/u.exec(line) : null;
    if (!match) throw new Error('Digest illustration requires its return-window excerpt.');
    return {
      label: labels[index],
      before: match[1],
      days: match[2],
      after: match[3],
      isSame: digests[index] === facts.originalDigest,
    };
  });
};
