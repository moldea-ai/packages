import type {
  IDeclaredRelationship,
  IDeclaredRelationshipSubject,
  IRelationshipDeclaration,
  IRelationshipDiagnostic,
  IRelationshipEvidence,
} from './types.js';

const BINDING_RELATIONSHIPS = {
  runtimeAgent: 'runtime-agent',
  instructionLoader: 'instruction-loader',
  inputSchema: 'agent-input-schema',
  outputSchema: 'agent-output-schema',
} as const;

/**
 * Visits declared relationships without retaining a second manifest-sized inventory.
 * @param declaration The selected agent's explicit source references.
 * @returns Applicable relationships in deterministic order.
 */
export function* iterateDeclaredRelationships(
  declaration: IRelationshipDeclaration,
): Generator<IDeclaredRelationshipSubject> {
  for (const [binding, relationship] of Object.entries(BINDING_RELATIONSHIPS)) {
    const reference = declaration.bindings?.[binding as keyof typeof BINDING_RELATIONSHIPS];
    if (reference !== undefined) yield { reference, relationship };
  }
  for (const variableId of Object.keys(declaration.bindings?.variableProviders ?? {}).sort()) {
    const reference = declaration.bindings?.variableProviders?.[variableId];
    if (reference !== undefined) yield { reference, relationship: 'variable-provider', variableId };
  }
  for (const capabilityId of Object.keys(declaration.tools ?? {}).sort()) {
    const tool = declaration.tools?.[capabilityId];
    if (tool === undefined) continue;
    const relationships = {
      implementation: 'tool-implementation',
      registration: 'tool-registration',
      inputSchema: 'tool-input-schema',
      outputSchema: 'tool-output-schema',
    } as const;
    for (const [binding, relationship] of Object.entries(relationships)) {
      const reference = tool[binding as keyof typeof relationships];
      if (reference !== undefined)
        yield { reference, relationship, capabilityId, capabilityKind: 'tool' };
    }
  }
  for (const capabilityId of Object.keys(declaration.skills ?? {}).sort()) {
    const skill = declaration.skills?.[capabilityId];
    if (skill === undefined) continue;
    yield {
      reference: skill.implementation,
      relationship: 'skill-implementation',
      capabilityId,
      capabilityKind: 'skill',
    };
    if (skill.registration !== undefined)
      yield {
        reference: skill.registration,
        relationship: 'skill-registration',
        capabilityId,
        capabilityKind: 'skill',
      };
  }
}

const getKey = (
  relationship: string,
  subject: { capabilityId?: string | null; capabilityKind?: string | null; variableId?: string },
): string =>
  JSON.stringify([
    relationship,
    subject.capabilityKind ?? null,
    subject.capabilityId ?? null,
    subject.variableId ?? null,
  ]);

const getErrorRelationship = (code: string): IDeclaredRelationship | null => {
  for (const [token, relationship] of [
    ['VARIABLE_PROVIDER_', 'variable-provider'],
    ['SKILL_IMPLEMENTATION_', 'skill-implementation'],
    ['SKILL_REGISTRATION_', 'skill-registration'],
    ['TOOL_IMPLEMENTATION_', 'tool-implementation'],
    ['TOOL_INPUT_SCHEMA_', 'tool-input-schema'],
    ['TOOL_OUTPUT_SCHEMA_', 'tool-output-schema'],
    ['TOOL_REGISTRATION_', 'tool-registration'],
    ['TOOL_NAME_', 'tool-registration'],
    ['INSTRUCTION_LOADER_', 'instruction-loader'],
    ['INSTRUCTION_SOURCE_MISMATCH', 'instruction-loader'],
    ['RUNTIME_AGENT_', 'runtime-agent'],
    ['INPUT_SCHEMA_', 'agent-input-schema'],
    ['OUTPUT_SCHEMA_', 'agent-output-schema'],
  ] as const) {
    if (code.includes('_' + token)) return relationship;
  }
  return null;
};

/**
 * Accounts for declared relationships using the existing adapter result records.
 * Only observed outcomes are retained; finalization emits each remaining warning lazily.
 * @param declaration Explicit agent declarations.
 * @param agentId The selected agent owning this invocation.
 * @param registrationIncludesHandler Whether the provider's registration wires executable handlers.
 * @returns Record observers and a finalizer for pending declarations.
 */
export const createRelationshipCoverage = (
  declaration: IRelationshipDeclaration,
  agentId: string,
  registrationIncludesHandler: boolean,
) => {
  const outcomes = new Set<string>();
  const observeSubject = (subject: IDeclaredRelationshipSubject): void => {
    outcomes.add(getKey(subject.relationship, subject));
  };
  const observeDiagnostic = (diagnostic: IRelationshipDiagnostic): void => {
    if (diagnostic.entity?.agentId !== agentId) return;
    const relationship =
      diagnostic.severity === 'warning'
        ? diagnostic.details['relationship']
        : diagnostic.code.endsWith('_SDK_FEATURE_UNAVAILABLE') &&
            diagnostic.details['feature'] === 'agent-output-schema'
          ? 'agent-output-schema'
          : getErrorRelationship(diagnostic.code);
    if (typeof relationship === 'string') outcomes.add(getKey(relationship, diagnostic.entity));
  };
  const observeEvidence = (evidence: IRelationshipEvidence): void => {
    if (evidence.agentId !== agentId) return;
    if (evidence.kind === 'runtime-pattern' || evidence.kind === 'agent-definition') {
      outcomes.add(getKey('runtime-agent', {}));
    } else if (evidence.kind === 'instruction-loader') {
      outcomes.add(getKey('instruction-loader', {}));
    } else if (evidence.kind === 'schema') {
      const role = evidence.details['schemaRole'] ?? evidence.details['role'];
      const relationships = {
        'agent-input': 'agent-input-schema',
        'agent-output': 'agent-output-schema',
        'tool-input': 'tool-input-schema',
        'tool-output': 'tool-output-schema',
        input: evidence.capabilityKind === 'tool' ? 'tool-input-schema' : 'agent-input-schema',
        output: evidence.capabilityKind === 'tool' ? 'tool-output-schema' : 'agent-output-schema',
      } as const;
      if (typeof role === 'string' && Object.hasOwn(relationships, role)) {
        outcomes.add(getKey(relationships[role as keyof typeof relationships], evidence));
      }
    } else if (evidence.kind === 'tool-registration') {
      outcomes.add(getKey('tool-registration', evidence));
      const implementation =
        evidence.capabilityId === null
          ? undefined
          : declaration.tools?.[evidence.capabilityId]?.implementation;
      if (
        registrationIncludesHandler &&
        implementation !== undefined &&
        evidence.references.some(
          (reference) =>
            reference.path === implementation.path && reference.symbol === implementation.symbol,
        )
      )
        outcomes.add(getKey('tool-implementation', evidence));
    } else if (evidence.kind === 'skill-registration') {
      outcomes.add(getKey('skill-registration', evidence));
      const implementation =
        evidence.capabilityId === null
          ? undefined
          : declaration.skills?.[evidence.capabilityId]?.implementation;
      if (
        registrationIncludesHandler &&
        implementation !== undefined &&
        evidence.references.some(
          (reference) =>
            reference.path === implementation.path && reference.symbol === implementation.symbol,
        )
      )
        outcomes.add(getKey('skill-implementation', evidence));
    }
  };
  const finalize = (emitUnverified: (subject: IDeclaredRelationshipSubject) => void): void => {
    for (const subject of iterateDeclaredRelationships(declaration)) {
      if (!outcomes.has(getKey(subject.relationship, subject))) emitUnverified(subject);
    }
    outcomes.clear();
  };
  return Object.freeze({ observeSubject, observeDiagnostic, observeEvidence, finalize });
};
