import type { IDiagnostic } from '@moldea.ai/core';

// exact reviewed diagnostics, including source ranges; never regenerated during website builds
export const CORE_EXPECTED_RESULTS: Record<
  string,
  { valid: boolean; diagnostics: (Omit<IDiagnostic, 'path'> & { path: string | null })[] }
> = {
  'utf8-invalid': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_TEXT_INVALID_UTF8',
        details: {},
        entity: null,
        message: 'The text document is not valid UTF-8.',
        path: '/moldea/project.md',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'unicode-invalid': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_TEXT_INVALID_UNICODE',
        details: {},
        entity: null,
        message: 'The text document contains an invalid Unicode scalar representation.',
        path: '/moldea/project.md',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'nul-forbidden': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_TEXT_NUL_FORBIDDEN',
        details: {},
        entity: null,
        message: 'The text document contains a forbidden NUL character.',
        path: '/moldea/project.md',
        pointer: null,
        range: {
          end: {
            column: 8,
            line: 1,
            offset: 7,
          },
          start: {
            column: 7,
            line: 1,
            offset: 6,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'manifest-valid': {
    valid: true,
    diagnostics: [],
  },
  'manifest-malformed': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_YAML_MALFORMED',
        details: {
          reason: 'syntax',
        },
        entity: null,
        message: 'The YAML document is malformed.',
        path: '/moldea/moldea.yaml',
        pointer: null,
        range: {
          end: {
            column: 1,
            line: 2,
            offset: 11,
          },
          start: {
            column: 1,
            line: 2,
            offset: 11,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'manifest-duplicate-key': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_YAML_DUPLICATE_KEY',
        details: {},
        entity: null,
        message: 'The YAML document contains a duplicate mapping key.',
        path: '/moldea/moldea.yaml',
        pointer: null,
        range: {
          end: {
            column: 2,
            line: 2,
            offset: 12,
          },
          start: {
            column: 1,
            line: 2,
            offset: 11,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'manifest-version': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_MANIFEST_VERSION_UNSUPPORTED',
        details: {},
        entity: null,
        message: 'The manifest version is unsupported.',
        path: '/moldea/moldea.yaml',
        pointer: '/version',
        range: {
          end: {
            column: 11,
            line: 1,
            offset: 10,
          },
          start: {
            column: 10,
            line: 1,
            offset: 9,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'manifest-unknown-property': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_MANIFEST_PROPERTY_UNKNOWN',
        details: {},
        entity: null,
        message: 'The manifest contains an unknown property.',
        path: '/moldea/moldea.yaml',
        pointer: '/agent',
        range: {
          end: {
            column: 6,
            line: 2,
            offset: 16,
          },
          start: {
            column: 1,
            line: 2,
            offset: 11,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'manifest-type': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_MANIFEST_VALUE_INVALID',
        details: {
          reason: 'mapping-required',
        },
        entity: null,
        message: 'The manifest value is invalid.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents',
        range: {
          end: {
            column: 11,
            line: 2,
            offset: 21,
          },
          start: {
            column: 9,
            line: 2,
            offset: 19,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'manifest-invalid-id': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_ID_INVALID',
        details: {},
        entity: {
          agentId: 'Support',
        },
        message: 'The ID is invalid.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents/Support',
        range: {
          end: {
            column: 10,
            line: 3,
            offset: 28,
          },
          start: {
            column: 3,
            line: 3,
            offset: 21,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'manifest-reserved-id': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_ID_RESERVED',
        details: {},
        entity: {
          agentId: 'con',
        },
        message: 'The ID uses a reserved filesystem name.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents/con',
        range: {
          end: {
            column: 6,
            line: 3,
            offset: 24,
          },
          start: {
            column: 3,
            line: 3,
            offset: 21,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'manifest-path': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_PATH_INVALID',
        details: {},
        entity: null,
        message: 'The manifest logical path is invalid.',
        path: '/moldea/moldea.yaml',
        pointer: '/context/~1moldea~1project.md/bindings/0/path',
        range: {
          end: {
            column: 37,
            line: 4,
            offset: 78,
          },
          start: {
            column: 24,
            line: 4,
            offset: 65,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'manifest-glob': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_GLOB_INVALID',
        details: {},
        entity: null,
        message: 'The impact pattern is invalid.',
        path: '/moldea/moldea.yaml',
        pointer: '/context/~1moldea~1project.md/affectedBy/0',
        range: {
          end: {
            column: 36,
            line: 4,
            offset: 77,
          },
          start: {
            column: 18,
            line: 4,
            offset: 59,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'manifest-duplicate-path': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_PATH_DUPLICATE',
        details: {},
        entity: null,
        message: 'The path is duplicated.',
        path: '/moldea/moldea.yaml',
        pointer: '/context/~1moldea~1project.md/affectedBy/1',
        range: {
          end: {
            column: 48,
            line: 4,
            offset: 89,
          },
          start: {
            column: 34,
            line: 4,
            offset: 75,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'manifest-duplicate-pattern': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_PATTERN_DUPLICATE',
        details: {},
        entity: null,
        message: 'The impact pattern is duplicated.',
        path: '/moldea/moldea.yaml',
        pointer: '/context/~1moldea~1project.md/affectedBy/1',
        range: {
          end: {
            column: 34,
            line: 4,
            offset: 75,
          },
          start: {
            column: 27,
            line: 4,
            offset: 68,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'binding-canonical-symbol': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_SYMBOL_FORBIDDEN',
        details: {},
        entity: null,
        message: 'A canonical moldea reference must not include a symbol.',
        path: '/moldea/moldea.yaml',
        pointer: '/context/~1moldea~1project.md/bindings/0/symbol',
        range: {
          end: {
            column: 66,
            line: 4,
            offset: 107,
          },
          start: {
            column: 60,
            line: 4,
            offset: 101,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'foundation-missing': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_PROJECT_FILE_MISSING',
        details: {},
        entity: null,
        message: 'The project file is missing.',
        path: '/moldea/project.md',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'manifest-missing': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_MANIFEST_MISSING',
        details: {},
        entity: null,
        message: 'The project manifest is missing.',
        path: '/moldea/moldea.yaml',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'canonical-unrecognized': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_CANONICAL_PATH_UNRECOGNIZED',
        details: {
          entryType: 'file',
        },
        entity: null,
        message: 'The canonical path is unrecognized.',
        path: '/moldea/notes.txt',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'canonical-entry-type': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_ENTRY_TYPE_INVALID',
        details: {
          actualType: 'directory',
          expectedType: 'file',
        },
        entity: null,
        message: 'The repository entry type is invalid.',
        path: '/moldea/moldea.yaml',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'policy-reference-connected': {
    valid: true,
    diagnostics: [],
  },
  'policy-reference-missing': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_REFERENCE_MISSING',
        details: {
          referencedPath: '/src/returns/policy.ts',
        },
        entity: null,
        message: 'The referenced repository path does not exist.',
        path: '/moldea/moldea.yaml',
        pointer: '/context/~1moldea~1project.md/bindings/0',
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'policy-reference-directory': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_REFERENCE_NOT_FILE',
        details: {
          actualType: 'directory',
          referencedPath: '/src/returns',
        },
        entity: null,
        message: 'The referenced repository path is not a regular file.',
        path: '/moldea/moldea.yaml',
        pointer: '/context/~1moldea~1project.md/bindings/0',
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'exact-impact-missing': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_IMPACT_PATH_MISSING',
        details: {
          impactPath: '/src/returns/policy.ts',
        },
        entity: null,
        message: 'The exact impact path does not exist.',
        path: '/moldea/moldea.yaml',
        pointer: '/context/~1moldea~1project.md/affectedBy/0',
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'exact-impact-directory': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_IMPACT_PATH_NOT_FILE',
        details: {
          actualType: 'directory',
          impactPath: '/src/returns',
        },
        entity: null,
        message: 'The exact impact path is not a regular file.',
        path: '/moldea/moldea.yaml',
        pointer: '/context/~1moldea~1project.md/affectedBy/0',
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'runtime-invalid-id': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_RUNTIME_ID_INVALID',
        details: {},
        entity: {
          agentId: 'support',
        },
        message: 'The runtime adapter ID is invalid.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents/support/runtime/id',
        range: {
          end: {
            column: 26,
            line: 4,
            offset: 55,
          },
          start: {
            column: 20,
            line: 4,
            offset: 49,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'agent-context-present': {
    valid: true,
    diagnostics: [],
  },
  'agent-context-empty': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_CONTEXT_FILE_EMPTY',
        details: {},
        entity: null,
        message: 'The focused context file is empty.',
        path: '/moldea/context/returns.md',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'agent-context-missing': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_REFERENCE_MISSING',
        details: {
          referencedPath: '/moldea/context/returns.md',
        },
        entity: {
          agentId: 'support',
        },
        message: 'The referenced repository path does not exist.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents/support/context',
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'agent-valid': {
    valid: true,
    diagnostics: [],
  },
  'agent-directory-missing': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_AGENT_DIRECTORY_MISSING',
        details: {},
        entity: {
          agentId: 'support',
        },
        message: 'The registered agent directory is missing.',
        path: '/moldea/agents/support',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'agent-unregistered': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_AGENT_DIRECTORY_UNREGISTERED',
        details: {},
        entity: {
          agentId: 'support',
        },
        message: 'The agent directory is not registered.',
        path: '/moldea/agents/support',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'agent-identity': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_AGENT_IDENTITY_INVALID',
        details: {
          reason: 'missing',
        },
        entity: {
          agentId: 'support',
        },
        message: 'The agent instruction identity is invalid.',
        path: '/moldea/agents/support/instruction.md',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'instruction-missing': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_AGENT_INSTRUCTION_MISSING',
        details: {},
        entity: {
          agentId: 'support',
        },
        message: 'The agent instruction is missing.',
        path: '/moldea/agents/support/instruction.md',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'instruction-empty': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_AGENT_INSTRUCTION_EMPTY',
        details: {},
        entity: {
          agentId: 'support',
        },
        message: 'The agent instruction is empty.',
        path: '/moldea/agents/support/instruction.md',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'description-missing': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_AGENT_DESCRIPTION_MISSING',
        details: {},
        entity: {
          agentId: 'support',
        },
        message: 'The agent description is missing.',
        path: '/moldea/agents/support/description.md',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'description-invalid': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_AGENT_DESCRIPTION_INVALID',
        details: {
          reason: 'runtime-variable-delimiter',
        },
        entity: {
          agentId: 'support',
        },
        message: 'The agent description is invalid.',
        path: '/moldea/agents/support/description.md',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'handoff-description-invalid': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_AGENT_HANDOFF_DESCRIPTION_INVALID',
        details: {
          reason: 'empty',
        },
        entity: {
          agentId: 'support',
        },
        message: 'The agent handoff description is invalid.',
        path: '/moldea/agents/support/handoff-description.md',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'variable-undeclared': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_VARIABLE_UNDECLARED',
        details: {
          occurrences: 1,
        },
        entity: {
          agentId: 'support',
          variableId: 'ORDER_ID',
        },
        message: 'The agent instruction references an undeclared runtime variable.',
        path: '/moldea/agents/support/instruction.md',
        pointer: null,
        range: {
          end: {
            column: 45,
            line: 4,
            offset: 116,
          },
          start: {
            column: 33,
            line: 4,
            offset: 104,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'variable-unused': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_VARIABLE_UNUSED',
        details: {},
        entity: {
          agentId: 'support',
          variableId: 'REGION',
        },
        message: 'The declared runtime variable is unused by the agent instruction.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents/support/variables/REGION',
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'variable-malformed': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_VARIABLE_PLACEHOLDER_MALFORMED',
        details: {
          reason: 'unmatched-opening',
        },
        entity: {
          agentId: 'support',
        },
        message: 'The agent instruction contains a malformed runtime-variable placeholder.',
        path: '/moldea/agents/support/instruction.md',
        pointer: null,
        range: {
          end: {
            column: 1,
            line: 5,
            offset: 93,
          },
          start: {
            column: 9,
            line: 4,
            offset: 80,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'variable-provider-undeclared': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_VARIABLE_PROVIDER_UNDECLARED',
        details: {},
        entity: {
          agentId: 'support',
          variableId: 'ORDER_ID',
        },
        message: 'A variable-provider binding exists for an undeclared variable.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents/support/bindings/variableProviders/ORDER_ID',
        range: {
          end: {
            column: 17,
            line: 10,
            offset: 192,
          },
          start: {
            column: 9,
            line: 10,
            offset: 184,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'tool-description-invalid': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_CAPABILITY_DESCRIPTION_INVALID',
        details: {},
        entity: {
          agentId: 'support',
          capabilityKind: 'tool',
          capabilityId: 'returns',
        },
        message: 'The capability description is invalid.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents/support/tools/returns/description',
        range: {
          end: {
            column: 65,
            line: 11,
            offset: 257,
          },
          start: {
            column: 22,
            line: 11,
            offset: 214,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'tool-implementation-missing': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_TOOL_IMPLEMENTATION_MISSING',
        details: {
          reason: 'missing',
          referencedPath: '/src/returns.ts',
        },
        entity: {
          agentId: 'support',
          capabilityKind: 'tool',
          capabilityId: 'returns',
        },
        message: 'The registered tool implementation is missing.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents/support/tools/returns/implementation',
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'tool-implementation-present': {
    valid: true,
    diagnostics: [],
  },
  'skill-description-invalid': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_CAPABILITY_DESCRIPTION_INVALID',
        details: {},
        entity: {
          agentId: 'support',
          capabilityKind: 'skill',
          capabilityId: 'returns',
        },
        message: 'The capability description is invalid.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents/support/skills/returns/description',
        range: {
          end: {
            column: 65,
            line: 11,
            offset: 258,
          },
          start: {
            column: 22,
            line: 11,
            offset: 215,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'skill-implementation-missing': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_SKILL_IMPLEMENTATION_MISSING',
        details: {
          reason: 'missing',
          referencedPath: '/src/returns.ts',
        },
        entity: {
          agentId: 'support',
          capabilityKind: 'skill',
          capabilityId: 'returns',
        },
        message: 'The registered skill implementation is missing.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents/support/skills/returns/implementation',
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'skill-implementation-present': {
    valid: true,
    diagnostics: [],
  },
  'capability-description-missing': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_CAPABILITY_DESCRIPTION_MISSING',
        details: {},
        entity: {
          agentId: 'support',
          capabilityKind: 'tool',
          capabilityId: 'returns',
        },
        message: 'The capability description is missing.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents/support/tools/returns/description',
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'mirror-equal': {
    valid: true,
    diagnostics: [],
  },
  'mirror-stale': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_MIRROR_STALE',
        details: {
          mirrorPath: '/instructions/support.md',
        },
        entity: {
          agentId: 'support',
        },
        message: 'The declared mirror differs from its canonical instruction.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents/support/mirrors/0',
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'mirror-missing': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_MIRROR_MISSING',
        details: {
          mirrorPath: '/instructions/support.md',
        },
        entity: {
          agentId: 'support',
        },
        message: 'The declared mirror does not exist.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents/support/mirrors/0',
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'mirror-directory': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_MIRROR_NOT_FILE',
        details: {
          actualType: 'directory',
          mirrorPath: '/instructions/support.md',
        },
        entity: {
          agentId: 'support',
        },
        message: 'The declared mirror is not a regular file.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents/support/mirrors/0',
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'mirror-canonical-destination': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_MIRROR_PATH_INSIDE_MOLDEA',
        details: {},
        entity: {
          agentId: 'support',
        },
        message: 'The mirror path is inside /moldea.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents/support/mirrors/0',
        range: {
          end: {
            column: 33,
            line: 8,
            offset: 169,
          },
          start: {
            column: 15,
            line: 8,
            offset: 151,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'mirror-duplicate-owner': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_MIRROR_PATH_DUPLICATE',
        details: {},
        entity: {
          agentId: 'support',
        },
        message: 'The mirror path is assigned more than once.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents/support/mirrors/1',
        range: {
          end: {
            column: 65,
            line: 8,
            offset: 201,
          },
          start: {
            column: 41,
            line: 8,
            offset: 177,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'runtime-guidance-present': {
    valid: true,
    diagnostics: [],
  },
  'runtime-guidance-empty': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_RUNTIME_GUIDANCE_EMPTY',
        details: {},
        entity: null,
        message: 'The runtime guidance is empty.',
        path: '/moldea/runtimes/service.md',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'runtime-guidance-missing': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_RUNTIME_GUIDANCE_MISSING',
        details: {
          referencedPath: '/moldea/runtimes/service.md',
        },
        entity: {
          agentId: 'support',
        },
        message: 'The referenced runtime guidance does not exist.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents/support/runtime/guidance',
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'runtime-adapter-unavailable': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_RUNTIME_ADAPTER_UNAVAILABLE',
        details: {},
        entity: {
          agentId: 'support',
          adapterId: 'openai',
        },
        message: 'The declared runtime adapter is unavailable.',
        path: '/moldea/moldea.yaml',
        pointer: '/agents/support/runtime/id',
        range: {
          end: {
            column: 26,
            line: 4,
            offset: 55,
          },
          start: {
            column: 20,
            line: 4,
            offset: 49,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'decision-frontmatter-invalid': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_DECISION_FRONTMATTER_INVALID',
        details: {
          reason: 'mapping-required',
        },
        entity: {
          decisionId: '1767225600000',
        },
        message: 'The decision frontmatter is invalid.',
        path: '/moldea/decisions/1767225600000-return-window.md',
        pointer: null,
        range: {
          end: {
            column: 3,
            line: 2,
            offset: 6,
          },
          start: {
            column: 1,
            line: 2,
            offset: 4,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'decision-valid': {
    valid: true,
    diagnostics: [],
  },
  'decision-filename': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_DECISION_FILENAME_INVALID',
        details: {},
        entity: null,
        message: 'The decision path or filename is invalid.',
        path: '/moldea/decisions/return-window.md',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'decision-frontmatter': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_DECISION_FRONTMATTER_MISSING',
        details: {},
        entity: {
          decisionId: '1767225600000',
        },
        message: 'The decision frontmatter or its delimiters are missing.',
        path: '/moldea/decisions/1767225600000-return-window.md',
        pointer: null,
        range: {
          end: {
            column: 31,
            line: 1,
            offset: 30,
          },
          start: {
            column: 1,
            line: 1,
            offset: 0,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'decision-timestamp': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_DECISION_TIMESTAMP_MISMATCH',
        details: {},
        entity: {
          decisionId: '1767225600000',
        },
        message: 'The decision filename timestamp and createdAt value do not match.',
        path: '/moldea/decisions/1767225600000-return-window.md',
        pointer: '/createdAt',
        range: {
          end: {
            column: 38,
            line: 3,
            offset: 58,
          },
          start: {
            column: 12,
            line: 3,
            offset: 32,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'decision-created-at': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_DECISION_CREATED_AT_INVALID',
        details: {},
        entity: {
          decisionId: '1767225600000',
        },
        message: 'The decision createdAt value is invalid.',
        path: '/moldea/decisions/1767225600000-return-window.md',
        pointer: '/createdAt',
        range: {
          end: {
            column: 23,
            line: 3,
            offset: 43,
          },
          start: {
            column: 12,
            line: 3,
            offset: 32,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'decision-body': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_DECISION_BODY_EMPTY',
        details: {},
        entity: {
          decisionId: '1767225600000',
        },
        message: 'The decision Markdown body is empty.',
        path: '/moldea/decisions/1767225600000-return-window.md',
        pointer: null,
        range: {
          end: {
            column: 4,
            line: 4,
            offset: 62,
          },
          start: {
            column: 4,
            line: 4,
            offset: 62,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'decision-replacement-chain': {
    valid: true,
    diagnostics: [],
  },
  'decision-reference-missing': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_DECISION_REFERENCE_MISSING',
        details: {
          referencedDecisionId: '1767225600000',
        },
        entity: {
          decisionId: '1767312000000',
        },
        message: 'The referenced decision does not exist.',
        path: '/moldea/decisions/1767312000000-extend-return-window.md',
        pointer: '/supersedes',
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'decision-self-reference': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_DECISION_SELF_SUPERSESSION',
        details: {},
        entity: {
          decisionId: '1767312000000',
        },
        message: 'The decision supersedes itself.',
        path: '/moldea/decisions/1767312000000-extend-return-window.md',
        pointer: '/supersedes/0',
        range: {
          end: {
            column: 29,
            line: 4,
            offset: 87,
          },
          start: {
            column: 14,
            line: 4,
            offset: 72,
          },
        },
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'decision-status-mismatch': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_DECISION_SUPERSESSION_STATUS_INVALID',
        details: {
          referencedDecisionId: '1767225600000',
          sourceStatus: 'accepted',
          targetStatus: 'accepted',
        },
        entity: {
          decisionId: '1767312000000',
        },
        message: 'The decision supersession relationship has inconsistent statuses.',
        path: '/moldea/decisions/1767312000000-extend-return-window.md',
        pointer: '/supersedes',
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'decision-orphan': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_DECISION_SUPERSEDED_ORPHAN',
        details: {},
        entity: {
          decisionId: '1767225600000',
        },
        message: 'The superseded decision has no active supersession relationship.',
        path: '/moldea/decisions/1767225600000-return-window.md',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'decision-cycle': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_DECISION_SUPERSESSION_CYCLE',
        details: {
          cycleRepresentativeDecisionId: '1767225600000',
          cycleSize: 2,
        },
        entity: {
          decisionId: '1767225600000',
        },
        message: 'The decision supersession graph contains a cycle.',
        path: '/moldea/decisions/1767225600000-return-window.md',
        pointer: '/supersedes',
        range: null,
        severity: 'error',
        source: 'core',
      },
      {
        code: 'MOLDEA_DECISION_SUPERSESSION_CYCLE',
        details: {
          cycleRepresentativeDecisionId: '1767225600000',
          cycleSize: 2,
        },
        entity: {
          decisionId: '1767312000000',
        },
        message: 'The decision supersession graph contains a cycle.',
        path: '/moldea/decisions/1767312000000-extend-return-window.md',
        pointer: '/supersedes',
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'decision-duplicate-id': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_DECISION_ID_DUPLICATE',
        details: {
          occurrences: 2,
        },
        entity: {
          decisionId: '1767225600000',
        },
        message: 'The decision ID is duplicated.',
        path: '/moldea/decisions/1767225600000-another-policy.md',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
      {
        code: 'MOLDEA_DECISION_ID_DUPLICATE',
        details: {
          occurrences: 2,
        },
        entity: {
          decisionId: '1767225600000',
        },
        message: 'The decision ID is duplicated.',
        path: '/moldea/decisions/1767225600000-return-window.md',
        pointer: null,
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
  'decision-relationship-accepted': {
    valid: true,
    diagnostics: [],
  },
  'decision-relationship-proposed': {
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_DECISION_RELATIONSHIP_INACTIVE',
        details: {
          referencedPath: '/moldea/decisions/1767225600000-return-window.md',
          targetStatus: 'proposed',
        },
        entity: {
          decisionId: '1767225600000',
        },
        message: 'The referenced decision is not accepted.',
        path: '/moldea/moldea.yaml',
        pointer: '/decisions/~1moldea~1decisions~11767225600000-return-window.md',
        range: null,
        severity: 'error',
        source: 'core',
      },
    ],
  },
};
