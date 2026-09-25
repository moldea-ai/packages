// @vitest-environment node
import { expect, test } from 'vitest';

import { INSTRUCTION_SNAPSHOT } from './constants.ts';
import { createInstructionExample } from './instruction-example.ts';

test('derives the hero from the real instruction, manifest, and Core diagnostic', async () => {
  const example = await createInstructionExample();
  expect(example).toStrictEqual(await createInstructionExample());
  expect(example.instruction).toBe(INSTRUCTION_SNAPSHOT.instruction);
  expect(example.instructionPath).toBe('/moldea/agents/support/instruction.md');
  expect(example.implementationPath).toBe(INSTRUCTION_SNAPSHOT.implementationPath);
  expect(example.result.valid).toBe(false);
  expect(example.result.diagnostics).toStrictEqual([
    {
      code: 'MOLDEA_TOOL_IMPLEMENTATION_MISSING',
      message: 'The registered tool implementation is missing.',
      path: '/moldea/moldea.yaml',
      pointer: '/agents/support/tools/get-delivery-status/implementation',
      entity: { agentId: 'support', capabilityKind: 'tool', capabilityId: 'get-delivery-status' },
      details: { reason: 'missing', referencedPath: '/src/orders/tracking.ts' },
      range: null,
      severity: 'error',
      source: 'core',
    },
  ]);
  expect(JSON.stringify(example.result)).not.toMatch(/sourceKind|snapshotId|You are the/iu);
});

test('rejects a repaired fixture rather than publishing a fabricated failure', async () => {
  const snapshot = structuredClone(INSTRUCTION_SNAPSHOT);
  snapshot.sourceFiles.push({
    path: snapshot.implementationPath,
    content: 'throw new Error("Core must not execute implementation files.");\n',
  });
  await expect(createInstructionExample(snapshot)).rejects.toThrow(
    'The instruction example produced unexpected Core results.',
  );
});

test('rejects changed references, additional diagnostics, and malformed instructions', async () => {
  for (const snapshot of [
    { ...INSTRUCTION_SNAPSHOT, implementationPath: '/src/orders/another-missing-file.ts' },
    { ...INSTRUCTION_SNAPSHOT, implementationPath: '/moldea/project.md' },
    { ...INSTRUCTION_SNAPSHOT, instruction: '' },
    {
      ...INSTRUCTION_SNAPSHOT,
      instruction: `${INSTRUCTION_SNAPSHOT.instruction}Also use {{UNKNOWN}}.\n`,
    },
  ]) {
    await expect(createInstructionExample(snapshot)).rejects.toThrow(
      'The instruction example produced unexpected Core results.',
    );
  }
});
