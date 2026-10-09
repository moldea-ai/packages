import type { IRuntimeAdapterContext, IRuntimeAdapterResult } from '../adapter/index.js';
import { createRuntimeAdapterResultCollector } from '../adapter-result-collection/index.js';
import type { IDiagnosticEntity, IUnverifiedRelationship } from '../diagnostics/index.js';
import type { IRepositoryReference } from '../format/index.js';

/**
 * Reports the declared relationships that Core cannot verify for the reserved custom runtime.
 * @param context The universally validated agent and operation output allowance.
 * @returns A promise resolving to bounded relationship warnings without a registered adapter.
 * @throws
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 * - ABORTED: The Core operation was aborted.
 */
export const inspectCustomRuntimeRelationships = (
  context: IRuntimeAdapterContext,
): Promise<IRuntimeAdapterResult> => {
  const collector = createRuntimeAdapterResultCollector(context);
  const { bindings, tools, skills } = context.agent.declaration;

  const add = (
    reference: IRepositoryReference | undefined,
    relationship: IUnverifiedRelationship,
    entity: IDiagnosticEntity = {},
  ): void => {
    if (reference === undefined) return;

    collector.diagnostics.add(() => ({
      code: 'CUSTOM_RUNTIME_RELATIONSHIP_UNVERIFIED',
      details: { reason: 'unsupported-source-pattern', relationship },
      entity: { adapterId: 'custom', agentId: context.agent.id, ...entity },
      message: 'The declared runtime relationship could not be verified.',
      path: reference.path,
      pointer: null,
      range: null,
      severity: 'warning',
      source: 'custom',
    }));
  };

  add(bindings?.runtimeAgent, 'runtime-agent');
  add(bindings?.instructionLoader, 'instruction-loader');
  add(bindings?.inputSchema, 'agent-input-schema');
  add(bindings?.outputSchema, 'agent-output-schema');

  for (const [variableId, reference] of Object.entries(bindings?.variableProviders ?? {})) {
    add(reference, 'variable-provider', { variableId });
  }

  for (const [capabilityId, tool] of Object.entries(tools ?? {})) {
    const entity = { capabilityId, capabilityKind: 'tool' as const };
    add(tool.implementation, 'tool-implementation', entity);
    add(tool.registration, 'tool-registration', entity);
    add(tool.inputSchema, 'tool-input-schema', entity);
    add(tool.outputSchema, 'tool-output-schema', entity);
  }

  for (const [capabilityId, skill] of Object.entries(skills ?? {})) {
    const entity = { capabilityId, capabilityKind: 'skill' as const };
    add(skill.implementation, 'skill-implementation', entity);
    add(skill.registration, 'skill-registration', entity);
  }

  return Promise.resolve(collector.finalize());
};
