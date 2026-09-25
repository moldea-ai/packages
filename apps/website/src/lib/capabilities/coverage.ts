import type { ICoreDiagnosticCode } from '@moldea.ai/core';

import type { ICoreOperation, IDiagnosticCoverage, IRuntimePatternProof } from './types.ts';

// the release-owned inventory cannot silently shrink when a generator or case disappears
export const REQUIRED_CASE_IDS: string[] = [
  'utf8-invalid',
  'unicode-invalid',
  'nul-forbidden',
  'manifest-valid',
  'manifest-malformed',
  'manifest-duplicate-key',
  'manifest-version',
  'manifest-unknown-property',
  'manifest-type',
  'manifest-invalid-id',
  'manifest-reserved-id',
  'manifest-path',
  'manifest-glob',
  'manifest-duplicate-path',
  'manifest-duplicate-pattern',
  'binding-canonical-symbol',
  'foundation-missing',
  'manifest-missing',
  'canonical-unrecognized',
  'canonical-entry-type',
  'policy-reference-connected',
  'policy-reference-missing',
  'policy-reference-directory',
  'exact-impact-missing',
  'exact-impact-directory',
  'runtime-invalid-id',
  'agent-context-present',
  'agent-context-empty',
  'agent-context-missing',
  'agent-valid',
  'agent-directory-missing',
  'agent-unregistered',
  'agent-identity',
  'instruction-missing',
  'instruction-empty',
  'description-missing',
  'description-invalid',
  'handoff-description-invalid',
  'variable-undeclared',
  'variable-unused',
  'variable-malformed',
  'variable-provider-undeclared',
  'tool-description-invalid',
  'tool-implementation-missing',
  'tool-implementation-present',
  'skill-description-invalid',
  'skill-implementation-missing',
  'skill-implementation-present',
  'capability-description-missing',
  'mirror-equal',
  'mirror-stale',
  'mirror-missing',
  'mirror-directory',
  'mirror-canonical-destination',
  'mirror-duplicate-owner',
  'runtime-guidance-present',
  'runtime-guidance-empty',
  'runtime-guidance-missing',
  'runtime-adapter-unavailable',
  'decision-frontmatter-invalid',
  'decision-valid',
  'decision-filename',
  'decision-frontmatter',
  'decision-timestamp',
  'decision-created-at',
  'decision-body',
  'decision-replacement-chain',
  'decision-reference-missing',
  'decision-self-reference',
  'decision-status-mismatch',
  'decision-orphan',
  'decision-cycle',
  'decision-duplicate-id',
  'decision-relationship-accepted',
  'decision-relationship-proposed',
  'anthropic-messages',
  'anthropic-parse-output',
  'claude-query',
  'cloudflare-agents',
  'eve-filesystem',
  'google-generate-content',
  'google-mixed-generation',
  'langchain-create-agent',
  'langchain-direct-schema',
  'langchain-tool-strategy',
  'langgraph-workflows',
  'openai-responses',
  'openai-parse-output',
  'openai-agent-handoffs',
  'vercel-agent-and-stream',
  'claude-preset',
  'claude-inherited-tools',
  'langgraph-inline',
  'vercel-generate',
  'vercel-instruction-precedence',
  'vercel-system-fallback',
  'vercel-dynamic-preparation',
  'eve-flat-root',
  'eve-markdown-instruction',
  'eve-case-varied-instruction',
  'eve-system-instruction',
  'eve-nested-tool',
  'eve-tool-name-collision',
  'eve-flat-skill',
  'eve-packaged-skill',
  'eve-single-file-subagent',
  'eve-framework-namespace',
  'openai-loader-disconnected',
  'text-normalization',
  'normalized-digests',
  'inspection-metadata',
  'inspection-diagnostics',
  'inspection-evidence',
  'canonical-content-pages',
  'canonical-content-refusal',
  'core-resource-refusal',
  'manifest-change-relevance',
  'memory-immutable-ranges',
  'reader-entry-pages',
  'reader-exact-entry',
  'reader-invalid-cursor',
  'reader-snapshot-cursor',
  'reader-cancellation',
  'snapshot-comparison',
  'filesystem-selection',
  'filesystem-changed-snapshot',
  'filesystem-resource-boundary',
  'cli-validate',
  'cli-inspect-selection',
  'cli-scope-path',
  'cli-scope-stdin',
  'cli-canonical-content',
  'cli-content-continuation',
  'cli-content-refusal',
  'cli-composition',
  'cli-invalid-project',
];

// each public Core operation has a real executable example
export const CORE_OPERATION_COVERAGE: Record<ICoreOperation, string[]> = {
  normalizeText: ['text-normalization', 'utf8-invalid', 'unicode-invalid', 'nul-forbidden'],
  calculateContentDigest: ['normalized-digests'],
  parseManifest: ['manifest-valid', 'manifest-malformed', 'manifest-duplicate-key'],
  parseDecision: ['decision-valid', 'decision-filename', 'decision-frontmatter-invalid'],
  validateProject: ['agent-valid', 'policy-reference-missing', 'decision-replacement-chain'],
  createProjectInspection: ['inspection-metadata', 'inspection-diagnostics', 'inspection-evidence'],
  readCanonicalContentPage: [
    'canonical-content-pages',
    'canonical-content-refusal',
    'core-resource-refusal',
  ],
  matchManifestScope: ['manifest-change-relevance'],
};

// exhaustive public diagnostic accounting; documented variants are never labelled as executed
export const CORE_DIAGNOSTIC_COVERAGE: Record<ICoreDiagnosticCode, IDiagnosticCoverage> = {
  MOLDEA_MANIFEST_MISSING: {
    caseIds: ['manifest-missing'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_MANIFEST_PATH_INVALID: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_PROJECT_FILE_MISSING: {
    caseIds: ['foundation-missing'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_PROJECT_FILE_EMPTY: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_ENTRY_TYPE_INVALID: {
    caseIds: ['canonical-entry-type'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_CANONICAL_PATH_UNRECOGNIZED: {
    caseIds: ['canonical-unrecognized'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_CANONICAL_ASSET_SYMLINK: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_TEXT_INVALID_UTF8: {
    caseIds: ['utf8-invalid'],
    mode: 'demonstrated',
    note: 'The linked example executes this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_TEXT_INVALID_UNICODE: {
    caseIds: ['unicode-invalid'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_TEXT_NUL_FORBIDDEN: {
    caseIds: ['nul-forbidden'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_TEXT_EMPTY: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_YAML_MALFORMED: {
    caseIds: ['manifest-malformed'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_YAML_MULTIPLE_DOCUMENTS: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_YAML_FEATURE_UNSUPPORTED: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_YAML_DUPLICATE_KEY: {
    caseIds: ['manifest-duplicate-key'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_MANIFEST_ROOT_INVALID: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_MANIFEST_VERSION_MISSING: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_MANIFEST_VERSION_INVALID: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_MANIFEST_VERSION_UNSUPPORTED: {
    caseIds: ['manifest-version'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_MANIFEST_PROPERTY_UNKNOWN: {
    caseIds: ['manifest-unknown-property'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_MANIFEST_VALUE_INVALID: {
    caseIds: ['manifest-type'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_ID_INVALID: {
    caseIds: ['manifest-invalid-id'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_ID_RESERVED: {
    caseIds: ['manifest-reserved-id'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_ID_DUPLICATE: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_VARIABLE_ID_INVALID: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_PATH_INVALID: {
    caseIds: ['manifest-path'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_GLOB_INVALID: {
    caseIds: ['manifest-glob'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_PATH_DUPLICATE: {
    caseIds: ['manifest-duplicate-path'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_PATTERN_DUPLICATE: {
    caseIds: ['manifest-duplicate-pattern'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_IMPACT_PATH_MISSING: {
    caseIds: ['exact-impact-missing'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_IMPACT_PATH_NOT_FILE: {
    caseIds: ['exact-impact-directory'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_REFERENCE_MISSING: {
    caseIds: ['policy-reference-missing', 'agent-context-missing'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_REFERENCE_NOT_FILE: {
    caseIds: ['policy-reference-directory'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_REFERENCE_SYMLINK: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_SYMBOL_INVALID: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_SYMBOL_FORBIDDEN: {
    caseIds: ['binding-canonical-symbol'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_CONTEXT_PATH_INVALID: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_CONTEXT_RELATIONSHIP_EMPTY: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_CONTEXT_FILE_EMPTY: {
    caseIds: ['agent-context-empty'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_RUNTIME_GUIDANCE_MISSING: {
    caseIds: ['runtime-guidance-missing'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_RUNTIME_GUIDANCE_EMPTY: {
    caseIds: ['runtime-guidance-empty'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_DECISION_FILENAME_INVALID: {
    caseIds: ['decision-filename'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_DECISION_FRONTMATTER_MISSING: {
    caseIds: ['decision-frontmatter'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_DECISION_FRONTMATTER_INVALID: {
    caseIds: ['decision-frontmatter-invalid'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_DECISION_PROPERTY_UNKNOWN: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_DECISION_STATUS_INVALID: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_DECISION_CREATED_AT_INVALID: {
    caseIds: ['decision-created-at'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_DECISION_TIMESTAMP_MISMATCH: {
    caseIds: ['decision-timestamp'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_DECISION_BODY_EMPTY: {
    caseIds: ['decision-body'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_DECISION_ID_DUPLICATE: {
    caseIds: ['decision-duplicate-id'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_DECISION_REFERENCE_MISSING: {
    caseIds: ['decision-reference-missing'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_DECISION_SELF_SUPERSESSION: {
    caseIds: ['decision-self-reference'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_DECISION_SUPERSESSION_CYCLE: {
    caseIds: ['decision-cycle'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_DECISION_SUPERSESSION_STATUS_INVALID: {
    caseIds: ['decision-status-mismatch'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_DECISION_SUPERSEDED_ORPHAN: {
    caseIds: ['decision-orphan'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_DECISION_RELATIONSHIP_INACTIVE: {
    caseIds: ['decision-relationship-proposed'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_AGENT_DIRECTORY_UNREGISTERED: {
    caseIds: ['agent-unregistered'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_AGENT_DIRECTORY_MISSING: {
    caseIds: ['agent-directory-missing'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_AGENT_DESCRIPTION_MISSING: {
    caseIds: ['description-missing'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_AGENT_DESCRIPTION_INVALID: {
    caseIds: ['description-invalid'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_AGENT_INSTRUCTION_MISSING: {
    caseIds: ['instruction-missing'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_AGENT_INSTRUCTION_EMPTY: {
    caseIds: ['instruction-empty'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_AGENT_IDENTITY_INVALID: {
    caseIds: ['agent-identity'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_AGENT_HANDOFF_DESCRIPTION_INVALID: {
    caseIds: ['handoff-description-invalid'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_RUNTIME_ID_INVALID: {
    caseIds: ['runtime-invalid-id'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_RUNTIME_ADAPTER_UNAVAILABLE: {
    caseIds: ['runtime-adapter-unavailable'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_RUNTIME_ADAPTER_FORMAT_UNSUPPORTED: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_VARIABLE_PLACEHOLDER_MALFORMED: {
    caseIds: ['variable-malformed'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_VARIABLE_UNDECLARED: {
    caseIds: ['variable-undeclared'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_VARIABLE_UNUSED: {
    caseIds: ['variable-unused'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_VARIABLE_PROVIDER_UNDECLARED: {
    caseIds: ['variable-provider-undeclared'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_CAPABILITY_DESCRIPTION_MISSING: {
    caseIds: ['capability-description-missing'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_CAPABILITY_DESCRIPTION_INVALID: {
    caseIds: ['tool-description-invalid', 'skill-description-invalid'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_TOOL_IMPLEMENTATION_MISSING: {
    caseIds: ['tool-implementation-missing'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_SKILL_IMPLEMENTATION_MISSING: {
    caseIds: ['skill-implementation-missing'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_MIRROR_PATH_INVALID: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_MIRROR_PATH_INSIDE_MOLDEA: {
    caseIds: ['mirror-canonical-destination'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_MIRROR_PATH_DUPLICATE: {
    caseIds: ['mirror-duplicate-owner'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_MIRROR_MISSING: {
    caseIds: ['mirror-missing'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_MIRROR_NOT_FILE: {
    caseIds: ['mirror-directory'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_MIRROR_SYMLINK: {
    caseIds: [],
    mode: 'documented-boundary',
    note: 'This additional diagnostic variant is documented by Core; the catalog does not claim to execute it.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
  MOLDEA_MIRROR_STALE: {
    caseIds: ['mirror-stale'],
    mode: 'demonstrated',
    note: 'The linked examples execute this exact diagnostic code.',
    sourcePath: 'projects/core/docs/diagnostics.md',
  },
};

// exact matrix keys and source/result witnesses for every full or partial pattern
export const RUNTIME_PATTERN_PROOFS: Record<string, Record<string, IRuntimePatternProof[]>> = {
  'anthropic/typescript-messages-api-0-117': {
    'direct-messages-request-family': [
      {
        caseId: 'anthropic-messages',
        source: {
          path: '/src/agent.ts',
          contains: 'client.messages.create({',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'runtime-pattern',
          agentId: 'support',
          runtimeName: 'messages.create',
        },
      },
      {
        caseId: 'anthropic-parse-output',
        source: { path: '/src/agent.ts', contains: 'client.messages.parse({' },
        witness: {
          kind: 'evidence',
          evidenceKind: 'runtime-pattern',
          agentId: 'support',
          runtimeName: 'messages.parse',
        },
      },
    ],
    'direct-system-loader': [
      {
        caseId: 'anthropic-messages',
        source: {
          path: '/src/agent.ts',
          contains: 'system: readInstruction(),',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'instruction-loader',
          agentId: 'support',
        },
      },
    ],
    'closed-client-tool-array': [
      {
        caseId: 'anthropic-messages',
        source: {
          path: '/src/agent.ts',
          contains: 'tools: [registeredFindOrder]',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'support',
        },
      },
    ],
    'direct-tool-input-schema': [
      {
        caseId: 'anthropic-messages',
        source: {
          path: '/src/find-order.ts',
          contains: 'input_schema: FindOrderInput',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'support',
          details: {
            schemaRole: 'input',
          },
        },
      },
    ],
    'direct-output-schema': [
      {
        caseId: 'anthropic-parse-output',
        source: {
          path: '/src/agent.ts',
          contains: "output_config: { format: { type: 'json_schema', schema: SupportOutput } }",
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'support',
          details: { requestProperty: 'output_config.format', schemaRole: 'output' },
        },
      },
    ],
    'effective-messages-options': [
      {
        caseId: 'anthropic-parse-output',
        source: { path: '/src/agent.ts', contains: 'timeout: 1000' },
        witness: {
          kind: 'evidence',
          evidenceKind: 'instruction-loader',
          agentId: 'support',
        },
      },
    ],
  },
  'claude-agent-sdk/typescript-query-subagents-0-3': {
    'direct-query-wrapper': [
      {
        caseId: 'claude-query',
        source: {
          path: '/src/runtime.ts',
          contains: 'query({',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'runtime-pattern',
          agentId: 'triage',
          details: {
            patternId: 'direct-query-wrapper',
          },
        },
      },
    ],
    'query-custom-system-prompt': [
      {
        caseId: 'claude-query',
        source: {
          path: '/src/runtime.ts',
          contains: 'systemPrompt: await loadTriageInstruction(),',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'instruction-loader',
          agentId: 'triage',
          details: {
            role: 'query-system-prompt',
          },
        },
      },
    ],
    'query-preset-append': [
      {
        caseId: 'claude-preset',
        source: {
          path: '/src/runtime.ts',
          contains: 'append: await loadTriageInstruction()',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'instruction-loader',
          agentId: 'triage',
          details: {
            role: 'query-preset-append',
          },
        },
      },
    ],
    'programmatic-agent-definition': [
      {
        caseId: 'claude-query',
        source: {
          path: '/src/agents.ts',
          contains: 'export const billingAgent = {',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'agent-definition',
          agentId: 'billing',
        },
      },
    ],
    'closed-programmatic-agents-map': [
      {
        caseId: 'claude-query',
        source: {
          path: '/src/runtime.ts',
          contains: 'agents: { billing: billingAgent }',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'handoff-registration',
          agentId: 'triage',
        },
      },
    ],
    'query-agent-delegation-availability': [
      {
        caseId: 'claude-query',
        source: {
          path: '/src/runtime.ts',
          contains: "tools: ['Agent']",
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'handoff-registration',
          agentId: 'triage',
          details: {
            delegationTool: 'Agent',
          },
        },
      },
    ],
    'effective-routing-description': [
      {
        caseId: 'claude-query',
        source: {
          path: '/src/agents.ts',
          contains: "description: 'Route billing questions and payment issues here.'",
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'handoff-registration',
          agentId: 'triage',
        },
      },
    ],
    'query-json-schema-output': [
      {
        caseId: 'claude-query',
        source: {
          path: '/src/runtime.ts',
          contains: "outputFormat: { type: 'json_schema', schema: TriageOutputSchema }",
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'triage',
          details: {
            role: 'agent-output',
          },
        },
      },
    ],
    'sdk-mcp-tool-declaration': [
      {
        caseId: 'claude-query',
        source: {
          path: '/src/tools.ts',
          contains: 'export const findOrderTool = tool(',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'triage',
          details: {
            registrationKind: 'sdk-mcp-tool',
          },
        },
      },
    ],
    'sdk-mcp-server-registration': [
      {
        caseId: 'claude-query',
        source: {
          path: '/src/tools.ts',
          contains: 'createSdkMcpServer({',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'triage',
          details: {
            serverKey: 'support',
          },
        },
      },
    ],
    'inherited-subagent-tools': [
      {
        caseId: 'claude-inherited-tools',
        source: {
          path: '/src/agents.ts',
          contains: 'prompt: loadBillingInstruction()',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'billing',
          details: {
            availabilitySource: 'inherited-subagent-tools',
          },
        },
      },
    ],
    'explicit-subagent-tools': [
      {
        caseId: 'claude-query',
        source: {
          path: '/src/agents.ts',
          contains: "tools: ['mcp__support__find_order']",
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'billing',
          details: {
            availabilitySource: 'explicit-subagent-tools',
          },
        },
      },
    ],
  },
  'cloudflare-agents/typescript-think-0-16-ai-sdk-7': {
    'directly-exported-think-class': [
      {
        caseId: 'cloudflare-agents',
        source: {
          path: '/src/agents.ts',
          contains: 'export class SupportAgent extends Think',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'agent-definition',
          agentId: 'support',
        },
      },
    ],
    'think-instruction-methods': [
      {
        caseId: 'cloudflare-agents',
        source: {
          path: '/src/agents.ts',
          contains: 'getSystemPrompt() { return loadSupportInstruction(); }',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'instruction-loader',
          agentId: 'support',
        },
      },
    ],
    'closed-think-tools-map': [
      {
        caseId: 'cloudflare-agents',
        source: {
          path: '/src/agents.ts',
          contains:
            'getTools() { return { find_order: findOrderTool, summarize: summaryHandoffTool }; }',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'support',
        },
      },
    ],
  },
  'cloudflare-agents/typescript-ai-chat-agent-0-10-ai-sdk-7': {
    'directly-exported-ai-chat-agent-class': [
      {
        caseId: 'cloudflare-agents',
        source: {
          path: '/src/agents.ts',
          contains: 'export class SummaryAgent extends AIChatAgent',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'agent-definition',
          agentId: 'summary',
        },
      },
    ],
    'direct-ai-sdk-generation': [
      {
        caseId: 'cloudflare-agents',
        source: {
          path: '/src/agents.ts',
          contains: 'return streamText({',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'runtime-pattern',
          agentId: 'summary',
          details: {
            calls: 'streamText',
          },
        },
      },
    ],
    'ai-chat-structured-output-and-tools': [
      {
        caseId: 'cloudflare-agents',
        source: {
          path: '/src/agents.ts',
          contains: 'Output.object({ schema: SummaryOutputSchema })',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'summary',
          details: {
            schemaRole: 'agent-output',
          },
        },
      },
      {
        caseId: 'cloudflare-agents',
        source: {
          path: '/src/agents.ts',
          contains: 'tools: { find_order: findOrderTool }',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'summary',
        },
      },
    ],
  },
  'custom/custom': {
    'explicit-repository-relationships': [
      {
        caseId: 'agent-valid',
        source: {
          path: '/moldea/agents/support/instruction.md',
          contains: 'You are the `support` agent.',
        },
        witness: {
          kind: 'validation',
        },
      },
    ],
  },
  'eve/typescript-filesystem-agent-0-39': {
    'nested-root-agent': [
      {
        caseId: 'eve-filesystem',
        source: {
          path: '/agent/agent.ts',
          contains: 'export default defineAgent(',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'agent-definition',
          agentId: 'support',
          details: {
            agentKind: 'root',
            layout: 'nested',
          },
        },
      },
    ],
    'flat-root-agent': [
      {
        caseId: 'eve-flat-root',
        source: {
          path: '/agent.ts',
          contains: 'export default defineAgent(',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'agent-definition',
          agentId: 'support',
          details: {
            agentKind: 'root',
            layout: 'flat',
          },
        },
      },
    ],
    'directory-local-subagent': [
      {
        caseId: 'eve-filesystem',
        source: {
          path: '/agent/subagents/summary/agent.ts',
          contains: 'export default defineAgent(',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'handoff-registration',
          agentId: 'support',
          details: {
            targetAgentId: 'summary',
          },
        },
      },
    ],
    'single-file-local-subagent': [
      {
        caseId: 'eve-single-file-subagent',
        source: {
          path: '/agent/subagents/summary.ts',
          contains: 'export default defineAgent(',
        },
        witness: {
          kind: 'absence',
          evidenceKind: 'agent-definition',
          agentId: 'summary',
        },
      },
      {
        caseId: 'eve-single-file-subagent',
        source: {
          path: '/agent/subagents/summary.ts',
          contains: 'export default defineAgent(',
        },
        witness: {
          kind: 'absence',
          evidenceKind: 'handoff-registration',
          agentId: 'support',
        },
      },
    ],
    'effective-routing-description': [
      {
        caseId: 'eve-filesystem',
        source: {
          path: '/moldea/agents/summary/handoff-description.md',
          contains: 'Summarizes a support request.',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'handoff-registration',
          agentId: 'support',
          details: {
            routingDescriptionWired: true,
          },
        },
      },
    ],
    'exact-lowercase-markdown-instruction': [
      {
        caseId: 'eve-markdown-instruction',
        source: {
          path: '/agent/instructions.md',
          contains: 'Support customers with order and delivery questions.',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'instruction-loader',
          agentId: 'support',
        },
      },
    ],
    'exclusive-typescript-instruction-loader': [
      {
        caseId: 'eve-filesystem',
        source: {
          path: '/agent/instructions.ts',
          contains: 'content: loadInstruction()',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'instruction-loader',
          agentId: 'support',
        },
      },
    ],
    'case-varied-markdown-instruction': [
      {
        caseId: 'eve-case-varied-instruction',
        source: {
          path: '/agent/Instructions.md',
          contains: 'Support customers.',
        },
        witness: {
          kind: 'absence',
          evidenceKind: 'instruction-loader',
          agentId: 'support',
        },
      },
    ],
    'legacy-system-instruction': [
      {
        caseId: 'eve-system-instruction',
        source: {
          path: '/agent/system.md',
          contains: 'Support customers.',
        },
        witness: {
          kind: 'absence',
          evidenceKind: 'instruction-loader',
          agentId: 'support',
        },
      },
    ],
    'recursive-filesystem-tool': [
      {
        caseId: 'eve-nested-tool',
        source: {
          path: '/agent/tools/orders/search.ts',
          contains: 'defineTool(',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'support',
          details: {
            pathDepth: 2,
          },
        },
      },
    ],
    'flattened-tool-runtime-name': [
      {
        caseId: 'eve-nested-tool',
        source: {
          path: '/moldea/moldea.yaml',
          contains: 'name: orders-search',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'support',
          details: {
            pathDepth: 2,
          },
        },
      },
    ],
    'tool-runtime-name-collision': [
      {
        caseId: 'eve-tool-name-collision',
        source: {
          path: '/agent/tools/orders/search.ts',
          contains: 'defineTool(',
        },
        witness: {
          kind: 'diagnostic',
          code: 'EVE_TOOL_RUNTIME_NAME_COLLISION',
        },
      },
    ],
    'local-subagent-tool-namespace': [
      {
        caseId: 'eve-framework-namespace',
        source: {
          path: '/agent/subagents/glob/agent.ts',
          contains: 'defineAgent(',
        },
        witness: {
          kind: 'diagnostic',
          code: 'EVE_TOOL_SUBAGENT_NAME_COLLISION',
        },
      },
      {
        caseId: 'eve-filesystem',
        source: {
          path: '/agent/subagents/summary/agent.ts',
          contains: 'defineAgent(',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'handoff-registration',
          agentId: 'support',
        },
      },
    ],
    'flat-markdown-skill': [
      {
        caseId: 'eve-flat-skill',
        source: {
          path: '/agent/skills/analyze.md',
          contains: '# Analyze',
        },
        witness: {
          kind: 'absence',
          evidenceKind: 'skill-registration',
          agentId: 'support',
        },
      },
    ],
    'packaged-skill': [
      {
        caseId: 'eve-packaged-skill',
        source: {
          path: '/agent/skills/analyze/SKILL.md',
          contains: '# Analyze',
        },
        witness: {
          kind: 'absence',
          evidenceKind: 'skill-registration',
          agentId: 'support',
        },
      },
    ],
    'typescript-skill': [
      {
        caseId: 'eve-filesystem',
        source: {
          path: '/agent/skills/analyze.ts',
          contains: 'defineSkill(',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'skill-registration',
          agentId: 'support',
          details: {
            registrationKind: 'typescript',
          },
        },
      },
    ],
    'connections-and-framework-tools': [
      {
        caseId: 'eve-framework-namespace',
        source: {
          path: '/agent/subagents/glob/agent.ts',
          contains: 'defineAgent(',
        },
        witness: {
          kind: 'diagnostic',
          code: 'EVE_TOOL_SUBAGENT_NAME_COLLISION',
        },
      },
    ],
  },
  'google-genai/typescript-models-generate-content-2': {
    'direct-models-generate-content': [
      {
        caseId: 'google-generate-content',
        source: {
          path: '/src/agent.ts',
          contains: 'client.models.generateContent({',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'runtime-pattern',
          agentId: 'support',
          runtimeName: 'models.generateContent',
        },
      },
      {
        caseId: 'google-mixed-generation',
        source: { path: '/src/agent.ts', contains: 'client.models.generateContentStream({' },
        witness: {
          kind: 'evidence',
          evidenceKind: 'runtime-pattern',
          agentId: 'support',
          runtimeName: 'models.generateContentStream',
        },
      },
    ],
    'direct-config-system-instruction': [
      {
        caseId: 'google-generate-content',
        source: {
          path: '/src/agent.ts',
          contains: 'systemInstruction: await readInstruction(),',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'instruction-loader',
          agentId: 'support',
        },
      },
    ],
    'closed-function-declaration-tools': [
      {
        caseId: 'google-generate-content',
        source: {
          path: '/src/agent.ts',
          contains: 'functionDeclarations: [registeredFindOrder]',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'support',
        },
      },
    ],
    'direct-parameters-json-schema': [
      {
        caseId: 'google-generate-content',
        source: {
          path: '/src/find-order.ts',
          contains: 'parametersJsonSchema: FindOrderInput',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'support',
          details: {
            schemaRole: 'input',
          },
        },
      },
    ],
  },
  'langchain/typescript-create-agent-1-5': {
    'direct-create-agent': [
      {
        caseId: 'langchain-create-agent',
        source: {
          path: '/src/agent.ts',
          contains: 'createAgent({',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'agent-definition',
          agentId: 'support',
        },
      },
    ],
    'langchain-primary-boundary': [
      {
        caseId: 'langchain-create-agent',
        source: {
          path: '/package.json',
          contains: '"langchain"',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'runtime-package',
          agentId: 'support',
          details: {
            packageRole: 'primary',
            packageName: 'langchain',
          },
        },
      },
    ],
    'direct-system-prompt-loader': [
      {
        caseId: 'langchain-create-agent',
        source: {
          path: '/src/agent.ts',
          contains: 'systemPrompt: new SystemMessage(loadSupportInstruction())',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'instruction-loader',
          agentId: 'support',
        },
      },
    ],
    'direct-response-format-schema': [
      {
        caseId: 'langchain-direct-schema',
        source: {
          path: '/src/agent.ts',
          contains: 'responseFormat: SupportOutputSchema',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'support',
          details: {
            schemaStrategy: 'direct',
          },
        },
      },
    ],
    'structured-output-strategies': [
      {
        caseId: 'langchain-create-agent',
        source: {
          path: '/src/agent.ts',
          contains: 'providerStrategy({ schema: SupportOutputSchema, strict: true })',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'support',
          details: {
            schemaStrategy: 'provider-strategy',
          },
        },
      },
      {
        caseId: 'langchain-tool-strategy',
        source: {
          path: '/src/agent.ts',
          contains: 'toolStrategy(SupportOutputSchema)',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'support',
          details: {
            schemaStrategy: 'tool-strategy',
          },
        },
      },
    ],
    'normal-function-tools': [
      {
        caseId: 'langchain-create-agent',
        source: {
          path: '/src/tools.ts',
          contains: 'tool(findOrder,',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'support',
          details: {
            registrationForm: 'normal-function-tool',
          },
        },
      },
    ],
    'closed-tool-collections': [
      {
        caseId: 'langchain-create-agent',
        source: {
          path: '/src/agent.ts',
          contains: 'const TOOLS = [findOrderTool]',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'support',
        },
      },
    ],
  },
  'langgraph/typescript-state-graph-1-4': {
    'direct-compiled-state-graph': [
      {
        caseId: 'langgraph-workflows',
        source: {
          path: '/src/graph.ts',
          contains: "builder.compile({ name: 'support_graph' })",
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'agent-definition',
          agentId: 'graph',
        },
      },
    ],
    'inline-state-graph-builder': [
      {
        caseId: 'langgraph-inline',
        source: {
          path: '/src/graph.ts',
          contains: 'export const supportGraph = new StateGraph(',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'agent-definition',
          agentId: 'graph',
          details: {
            builderForm: 'inline-fluent',
          },
        },
      },
    ],
    'single-owner-state-graph-builder': [
      {
        caseId: 'langgraph-workflows',
        source: {
          path: '/src/graph.ts',
          contains: 'const builder = new StateGraph(',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'agent-definition',
          agentId: 'graph',
          details: {
            builderForm: 'module-local',
          },
        },
      },
    ],
    'graph-input-output-schemas': [
      {
        caseId: 'langgraph-workflows',
        source: {
          path: '/src/graph.ts',
          contains: 'input: GraphInputSchema',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'graph',
          details: {
            schemaRole: 'agent-input',
          },
        },
      },
      {
        caseId: 'langgraph-workflows',
        source: {
          path: '/src/graph.ts',
          contains: 'output: GraphOutputSchema',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'graph',
          details: {
            schemaRole: 'agent-output',
          },
        },
      },
    ],
    'direct-node-registration': [
      {
        caseId: 'langgraph-workflows',
        source: {
          path: '/src/graph.ts',
          contains: "builder.addNode('prepare', prepare)",
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'runtime-pattern',
          agentId: 'graph',
          details: {
            patternId: 'state-graph-node',
          },
        },
      },
    ],
    'direct-edge-registration': [
      {
        caseId: 'langgraph-workflows',
        source: {
          path: '/src/graph.ts',
          contains: "builder.addEdge(START, 'prepare')",
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'runtime-pattern',
          agentId: 'graph',
          details: {
            patternId: 'state-graph-edge',
          },
        },
      },
    ],
    'conditional-edge-registration': [
      {
        caseId: 'langgraph-workflows',
        source: {
          path: '/src/graph.ts',
          contains: "builder.addConditionalEdges('respond', route, { done: END })",
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'runtime-pattern',
          agentId: 'graph',
          details: {
            patternId: 'state-graph-conditional-edge',
          },
        },
      },
    ],
    'compile-runtime-name': [
      {
        caseId: 'langgraph-workflows',
        source: {
          path: '/src/graph.ts',
          contains: "compile({ name: 'support_graph' })",
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'agent-definition',
          agentId: 'graph',
          details: {
            apiKind: 'state-graph',
          },
        },
      },
    ],
  },
  'langgraph/typescript-functional-api-1-4': {
    'direct-functional-entrypoint': [
      {
        caseId: 'langgraph-workflows',
        source: {
          path: '/src/functional.ts',
          contains: "entrypoint({ name: 'support_workflow' }",
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'agent-definition',
          agentId: 'functional',
          details: {
            apiKind: 'functional',
          },
        },
      },
    ],
    'direct-functional-tasks': [
      {
        caseId: 'langgraph-workflows',
        source: {
          path: '/src/functional.ts',
          contains: "task('prepare_task'",
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'runtime-pattern',
          agentId: 'functional',
          details: {
            patternId: 'functional-task',
          },
        },
      },
    ],
    'functional-interrupt': [
      {
        caseId: 'langgraph-workflows',
        source: {
          path: '/src/functional.ts',
          contains: 'interrupt({ prepared })',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'runtime-pattern',
          agentId: 'functional',
          details: {
            patternId: 'functional-interrupt',
          },
        },
      },
    ],
    'functional-previous-state': [
      {
        caseId: 'langgraph-workflows',
        source: {
          path: '/src/functional.ts',
          contains: 'getPreviousState<unknown>()',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'runtime-pattern',
          agentId: 'functional',
          details: {
            patternId: 'functional-previous-state',
          },
        },
      },
    ],
    'functional-final-state': [
      {
        caseId: 'langgraph-workflows',
        source: {
          path: '/src/functional.ts',
          contains: 'entrypoint.final<unknown, unknown>',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'runtime-pattern',
          agentId: 'functional',
          details: {
            patternId: 'functional-final-state',
          },
        },
      },
    ],
  },
  'openai/typescript-responses-api-7': {
    'direct-responses-runtime-agent': [
      {
        caseId: 'openai-responses',
        source: {
          path: '/src/agent.ts',
          contains: 'client.responses.create({',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'runtime-pattern',
          agentId: 'support',
          runtimeName: 'responses.create',
        },
      },
      {
        caseId: 'openai-parse-output',
        source: { path: '/src/agent.ts', contains: 'client.responses.parse({' },
        witness: {
          kind: 'evidence',
          evidenceKind: 'runtime-pattern',
          agentId: 'support',
          runtimeName: 'responses.parse',
        },
      },
    ],
    'direct-instruction-loader': [
      {
        caseId: 'openai-responses',
        source: {
          path: '/src/agent.ts',
          contains: 'instructions: readInstruction(),',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'instruction-loader',
          agentId: 'support',
        },
      },
    ],
    'static-function-tools': [
      {
        caseId: 'openai-responses',
        source: {
          path: '/src/agent.ts',
          contains: 'tools: [registeredFindOrder]',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'support',
        },
      },
    ],
    'direct-tool-input-schema': [
      {
        caseId: 'openai-responses',
        source: {
          path: '/src/find-order.ts',
          contains: 'parameters: FindOrderInput',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'support',
          details: {
            schemaRole: 'input',
          },
        },
      },
    ],
    'direct-output-schema': [
      {
        caseId: 'openai-parse-output',
        source: { path: '/src/agent.ts', contains: "zodTextFormat(SupportOutput, 'support')" },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'support',
          details: { requestProperty: 'text.format', schemaRole: 'output' },
        },
      },
    ],
    'effective-responses-options': [
      {
        caseId: 'openai-parse-output',
        source: { path: '/src/agent.ts', contains: 'body: {' },
        witness: {
          kind: 'evidence',
          evidenceKind: 'instruction-loader',
          agentId: 'support',
        },
      },
    ],
  },
  'openai-agents-sdk/typescript-agent-handoffs-0-16': {
    'direct-agent-construction': [
      {
        caseId: 'openai-agent-handoffs',
        source: {
          path: '/src/agents.ts',
          contains: 'billingAgent = new Agent({',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'agent-definition',
          agentId: 'billing',
        },
      },
    ],
    'agent-create-construction': [
      {
        caseId: 'openai-agent-handoffs',
        source: {
          path: '/src/agents.ts',
          contains: 'triageAgent = Agent.create({',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'agent-definition',
          agentId: 'triage',
        },
      },
    ],
    'direct-instruction-loader': [
      {
        caseId: 'openai-agent-handoffs',
        source: {
          path: '/src/agents.ts',
          contains: 'return await loadTriageInstruction(context)',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'instruction-loader',
          agentId: 'triage',
        },
      },
    ],
    'direct-agent-output-schema': [
      {
        caseId: 'openai-agent-handoffs',
        source: {
          path: '/src/agents.ts',
          contains: 'outputType: TriageOutputSchema',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'triage',
          details: {
            schemaRole: 'agent-output',
          },
        },
      },
    ],
    'closed-function-tool': [
      {
        caseId: 'openai-agent-handoffs',
        source: {
          path: '/src/tools.ts',
          contains: 'findOrderTool = tool({',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'triage',
        },
      },
    ],
    'closed-agent-tool-array': [
      {
        caseId: 'openai-agent-handoffs',
        source: {
          path: '/src/agents.ts',
          contains: 'const triageTools = [findOrderTool]',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'triage',
        },
      },
    ],
    'direct-agent-handoff': [
      {
        caseId: 'openai-agent-handoffs',
        source: {
          path: '/src/agents.ts',
          contains: 'const triageHandoffs = [billingAgent,',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'handoff-registration',
          agentId: 'triage',
          details: {
            registrationKind: 'agent',
          },
        },
      },
    ],
    'configured-handoff-helper': [
      {
        caseId: 'openai-agent-handoffs',
        source: {
          path: '/src/agents.ts',
          contains: 'handoff(billingAgent, {',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'handoff-registration',
          agentId: 'triage',
          details: {
            registrationKind: 'handoff',
          },
        },
      },
    ],
    'effective-routing-description': [
      {
        caseId: 'openai-agent-handoffs',
        source: {
          path: '/src/agents.ts',
          contains: 'handoffDescription: billingRoutingDescription',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'handoff-registration',
          agentId: 'triage',
          details: {
            routingDescriptionSource: 'target',
          },
        },
      },
    ],
    'registration-description-override': [
      {
        caseId: 'openai-agent-handoffs',
        source: {
          path: '/src/agents.ts',
          contains: 'toolDescriptionOverride: billingRoutingDescription',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'handoff-registration',
          agentId: 'triage',
          details: {
            routingDescriptionSource: 'override',
          },
        },
      },
    ],
  },
  'vercel-ai-sdk/typescript-tool-loop-agent-7': {
    'direct-tool-loop-agent-construction': [
      {
        caseId: 'vercel-agent-and-stream',
        source: {
          path: '/src/agents.ts',
          contains: 'new ToolLoopAgent({',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'agent-definition',
          agentId: 'support',
        },
      },
    ],
    'direct-agent-instruction-loader': [
      {
        caseId: 'vercel-agent-and-stream',
        source: {
          path: '/src/agents.ts',
          contains: 'instructions: loadSupportInstruction()',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'instruction-loader',
          agentId: 'support',
        },
      },
    ],
    'call-options-input-schema': [
      {
        caseId: 'vercel-agent-and-stream',
        source: {
          path: '/src/agents.ts',
          contains: 'callOptionsSchema: SupportInputSchema',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'support',
          details: {
            schemaRole: 'agent-input',
          },
        },
      },
    ],
    'object-output-schema': [
      {
        caseId: 'vercel-agent-and-stream',
        source: {
          path: '/src/agents.ts',
          contains: 'schema: SupportOutputSchema',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'support',
          details: {
            schemaRole: 'agent-output',
          },
        },
      },
    ],
    'closed-tools-map': [
      {
        caseId: 'vercel-agent-and-stream',
        source: {
          path: '/src/agents.ts',
          contains: 'tools: { find_order: findOrderTool }',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'support',
        },
      },
    ],
    'direct-function-tool-bindings': [
      {
        caseId: 'vercel-agent-and-stream',
        source: {
          path: '/src/tools.ts',
          contains: 'execute: findOrder',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'support',
        },
      },
      {
        caseId: 'vercel-agent-and-stream',
        source: {
          path: '/src/tools.ts',
          contains: 'inputSchema: FindOrderInputSchema',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'support',
          details: {
            schemaRole: 'tool-input',
          },
        },
      },
      {
        caseId: 'vercel-agent-and-stream',
        source: {
          path: '/src/tools.ts',
          contains: 'outputSchema: FindOrderOutputSchema',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'support',
          details: {
            schemaRole: 'tool-output',
          },
        },
      },
    ],
  },
  'vercel-ai-sdk/typescript-generate-stream-text-7': {
    'direct-generate-text-wrapper': [
      {
        caseId: 'vercel-generate',
        source: {
          path: '/src/agents.ts',
          contains: 'async () => generateText({',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'runtime-pattern',
          agentId: 'summary',
          details: {
            calls: 'generateText',
          },
        },
      },
    ],
    'direct-stream-text-wrapper': [
      {
        caseId: 'vercel-agent-and-stream',
        source: {
          path: '/src/agents.ts',
          contains: 'async () => streamText({',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'runtime-pattern',
          agentId: 'summary',
          details: {
            calls: 'streamText',
          },
        },
      },
    ],
    'instructions-system-precedence': [
      {
        caseId: 'vercel-instruction-precedence',
        source: {
          path: '/src/agents.ts',
          contains:
            "system: 'A fallback instruction.', instructions: await loadSummaryInstruction()",
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'instruction-loader',
          agentId: 'summary',
        },
      },
      {
        caseId: 'vercel-system-fallback',
        source: {
          path: '/src/agents.ts',
          contains: 'system: await loadSummaryInstruction()',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'instruction-loader',
          agentId: 'summary',
        },
      },
    ],
    'direct-generation-instruction-loader': [
      {
        caseId: 'vercel-agent-and-stream',
        source: {
          path: '/src/agents.ts',
          contains: 'instructions: await loadSummaryInstruction()',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'instruction-loader',
          agentId: 'summary',
        },
      },
    ],
    'object-output-schema': [
      {
        caseId: 'vercel-agent-and-stream',
        source: {
          path: '/src/agents.ts',
          contains: 'schema: SummaryOutputSchema',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'summary',
          details: {
            schemaRole: 'agent-output',
          },
        },
      },
    ],
    'closed-tools-map': [
      {
        caseId: 'vercel-agent-and-stream',
        source: {
          path: '/src/agents.ts',
          contains: 'tools: { find_order: findOrderTool }',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'summary',
        },
      },
    ],
    'direct-function-tool-bindings': [
      {
        caseId: 'vercel-agent-and-stream',
        source: {
          path: '/src/tools.ts',
          contains: 'execute: findOrder',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'tool-registration',
          agentId: 'summary',
        },
      },
      {
        caseId: 'vercel-agent-and-stream',
        source: {
          path: '/src/tools.ts',
          contains: 'inputSchema: FindOrderInputSchema',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'summary',
          details: {
            schemaRole: 'tool-input',
          },
        },
      },
      {
        caseId: 'vercel-agent-and-stream',
        source: {
          path: '/src/tools.ts',
          contains: 'outputSchema: FindOrderOutputSchema',
        },
        witness: {
          kind: 'evidence',
          evidenceKind: 'schema',
          agentId: 'summary',
          details: {
            schemaRole: 'tool-output',
          },
        },
      },
    ],
  },
};
