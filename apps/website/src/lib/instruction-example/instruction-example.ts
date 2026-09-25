import { isDeepStrictEqual } from 'node:util';
import { stringify } from 'yaml';

import { createCore } from '@moldea.ai/core';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { INSTRUCTION_SNAPSHOT } from './constants.ts';
import type { IInstructionExample, IInstructionSnapshot } from './types.ts';

/**
 * Builds the hero from a real missing-tool diagnostic, without executing the agent or its code.
 * @returns A promise resolving to the instruction, implementation path, and content-free result.
 * @throws
 * - The instruction example produced unexpected Core results.
 */
export const createInstructionExample = async (
  snapshot: IInstructionSnapshot = INSTRUCTION_SNAPSHOT,
): Promise<IInstructionExample> => {
  const instructionPath = '/moldea/agents/support/instruction.md';
  const repository = createMemoryRepositoryReader([
    {
      path: '/moldea/moldea.yaml',
      type: 'file',
      content: stringify({
        version: 1,
        agents: {
          support: {
            runtime: { id: 'custom' },
            tools: {
              'get-delivery-status': {
                name: 'get_delivery_status',
                description: 'Retrieves the delivery status of a customer order.',
                implementation: { path: snapshot.implementationPath },
              },
            },
          },
        },
      }),
    },
    {
      path: '/moldea/project.md',
      type: 'file',
      content: '# Customer support\n\nHelp customers track their orders.\n',
    },
    {
      path: '/moldea/agents/support/description.md',
      type: 'file',
      content: 'Helps customers with order and delivery questions.\n',
    },
    { path: instructionPath, type: 'file', content: snapshot.instruction },
    {
      path: '/moldea/runtimes/custom.md',
      type: 'file',
      content: 'The application loads the agent instruction and registers its tools.\n',
    },
    ...snapshot.sourceFiles.map(({ path, content }) => ({ path, type: 'file' as const, content })),
  ]);
  const validation = await createCore().validateProject({ repository });
  const diagnostics = structuredClone([...validation.diagnostics]);

  if (
    validation.valid ||
    !isDeepStrictEqual(diagnostics, [
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
    ])
  ) {
    throw new Error('The instruction example produced unexpected Core results.');
  }

  return {
    instructionPath,
    instruction: snapshot.instruction,
    implementationPath: snapshot.implementationPath,
    result: { valid: validation.valid, diagnostics },
  };
};
