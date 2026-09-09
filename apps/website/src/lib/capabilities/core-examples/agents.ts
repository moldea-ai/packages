import type { ICoreDiagnosticCode } from '@moldea.ai/core';
import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

import {
  AGENT_MANIFEST,
  createAgentEntries,
  createCoreEntries,
  INSTRUCTION_PATH,
  INSTRUCTION_TEXT,
} from './constants.ts';
import type { ICoreExampleDefinition } from './types.ts';

/** Replaces one authored file while retaining the rest of the synthetic project. */
const replaceFile = (path: string, content: string): IMemoryRepositoryEntry[] =>
  createAgentEntries().map((entry) =>
    entry.path === path ? { path, content, type: 'file' } : entry,
  );

/** Defines a complete agent check; its expected diagnostics are not inferred from execution. */
const agentCase = (
  id: string,
  title: string,
  description: string,
  entries: IMemoryRepositoryEntry[],
  expectedCodes: ICoreDiagnosticCode[],
): ICoreExampleDefinition => ({
  id,
  title,
  description,
  entries,
  expectedCodes,
  groupId: 'agents',
  operation: 'validateProject',
});

const mirrorManifest = `${AGENT_MANIFEST}    mirrors: [/instructions/support.md]\n`;

// canonical instructions, declared assets, and mirrors remain independent of runtime execution
export const AGENT_EXAMPLES: ICoreExampleDefinition[] = [
  agentCase(
    'runtime-invalid-id',
    'A runtime ID uses invalid syntax',
    'Runtime identifiers follow the manifest naming contract.',
    createAgentEntries(AGENT_MANIFEST.replace('id: custom', 'id: OpenAI')),
    ['MOLDEA_RUNTIME_ID_INVALID'],
  ),
  ...(['present', 'empty', 'missing'] as const).map((state) =>
    agentCase(
      `agent-context-${state}`,
      state === 'present'
        ? 'The agent is connected to its policy'
        : state === 'empty'
          ? 'The linked policy document is empty'
          : 'The linked policy document is missing',
      'Canonical context references must identify non-empty knowledge documents.',
      [
        ...createAgentEntries(`${AGENT_MANIFEST}    context: [/moldea/context/returns.md]\n`),
        ...(state === 'missing'
          ? []
          : [
              {
                path: '/moldea/context/returns.md',
                type: 'file' as const,
                content:
                  state === 'empty' ? '\n' : 'Returns are accepted within 30 days of delivery.\n',
              },
            ]),
      ],
      state === 'present'
        ? []
        : [state === 'empty' ? 'MOLDEA_CONTEXT_FILE_EMPTY' : 'MOLDEA_REFERENCE_MISSING'],
    ),
  ),
  agentCase(
    'agent-valid',
    'The instruction and declarations agree',
    'The agent identifies itself and uses its declared region variable.',
    createAgentEntries(),
    [],
  ),
  agentCase(
    'agent-directory-missing',
    'A registered agent has no directory',
    'Registration alone does not create the required canonical files.',
    createCoreEntries(AGENT_MANIFEST),
    ['MOLDEA_AGENT_DIRECTORY_MISSING'],
  ),
  agentCase(
    'agent-unregistered',
    'A directory without registration',
    'Canonical agent directories must appear in the manifest.',
    createCoreEntries('version: 1\n', [
      { path: INSTRUCTION_PATH, type: 'file', content: INSTRUCTION_TEXT },
    ]),
    ['MOLDEA_AGENT_DIRECTORY_UNREGISTERED'],
  ),
  agentCase(
    'agent-identity',
    'The instruction names a different agent',
    'The canonical identity must match the owning agent ID.',
    replaceFile(INSTRUCTION_PATH, INSTRUCTION_TEXT.replace('`support`', '`sales`')),
    ['MOLDEA_AGENT_IDENTITY_INVALID'],
  ),
  agentCase(
    'instruction-missing',
    'The agent has no instruction',
    'A description cannot substitute for a canonical instruction.',
    createAgentEntries().filter(({ path }) => path !== INSTRUCTION_PATH),
    ['MOLDEA_AGENT_INSTRUCTION_MISSING'],
  ),
  agentCase(
    'instruction-empty',
    'The instruction has no content',
    'An empty instruction cannot establish the agent identity.',
    replaceFile(INSTRUCTION_PATH, '\n'),
    ['MOLDEA_AGENT_INSTRUCTION_EMPTY'],
  ),
  agentCase(
    'description-missing',
    'The agent has no description',
    'The canonical description is required.',
    createAgentEntries().filter(({ path }) => !path.endsWith('/description.md')),
    ['MOLDEA_AGENT_DESCRIPTION_MISSING'],
  ),
  agentCase(
    'description-invalid',
    'A description requests a variable',
    'Descriptions cannot contain runtime-variable placeholders.',
    replaceFile(
      '/moldea/agents/support/description.md',
      'Explains return eligibility in {{REGION}}.\n',
    ),
    ['MOLDEA_AGENT_DESCRIPTION_INVALID'],
  ),
  agentCase(
    'handoff-description-invalid',
    'The routing description is empty',
    'An optional handoff description must be valid when present.',
    [
      ...createAgentEntries(),
      { path: '/moldea/agents/support/handoff-description.md', type: 'file', content: '\n' },
    ],
    ['MOLDEA_AGENT_HANDOFF_DESCRIPTION_INVALID'],
  ),
  agentCase(
    'variable-undeclared',
    'The instruction requests an undeclared variable',
    'ORDER_ID is used but has no declaration. No substitution is executed.',
    replaceFile(INSTRUCTION_PATH, `${INSTRUCTION_TEXT}Look up {{ORDER_ID}}.\n`),
    ['MOLDEA_VARIABLE_UNDECLARED'],
  ),
  agentCase(
    'variable-unused',
    'A declared variable is never used',
    'The region declaration has no matching placeholder in the instruction.',
    replaceFile(INSTRUCTION_PATH, 'You are the `support` agent.\n\nExplain return eligibility.\n'),
    ['MOLDEA_VARIABLE_UNUSED'],
  ),
  agentCase(
    'variable-malformed',
    'A placeholder is unfinished',
    'Malformed placeholders are reported separately from undeclared variables.',
    replaceFile(INSTRUCTION_PATH, `${INSTRUCTION_TEXT}Look up {{ORDER_ID}.\n`),
    ['MOLDEA_VARIABLE_PLACEHOLDER_MALFORMED'],
  ),
  agentCase(
    'variable-provider-undeclared',
    'A provider has no declared variable',
    'A variable-provider binding cannot silently introduce a new variable.',
    [
      ...createAgentEntries(
        `${AGENT_MANIFEST}    bindings:\n      variableProviders:\n        ORDER_ID: { path: /src/order.ts }\n`,
      ),
      {
        path: '/src/order.ts',
        type: 'file',
        content: 'export const orderId = (order: { id: string }) => order.id;\n',
      },
    ],
    ['MOLDEA_VARIABLE_PROVIDER_UNDECLARED'],
  ),
  ...(['tool', 'skill'] as const).flatMap((kind) => {
    const manifest = `${AGENT_MANIFEST}    ${kind}s:\n      returns:\n        name: explain_returns\n        description: Explains return eligibility using the current policy.\n        implementation: { path: /src/returns.ts }\n`;
    return [
      agentCase(
        `${kind}-description-invalid`,
        `The ${kind} description requests a runtime variable`,
        'Capability descriptions cannot contain runtime-variable placeholders.',
        createAgentEntries(
          manifest.replace(
            'Explains return eligibility using the current policy.',
            'Explains return eligibility for {{REGION}}.',
          ),
        ),
        ['MOLDEA_CAPABILITY_DESCRIPTION_INVALID'],
      ),
      agentCase(
        `${kind}-implementation-missing`,
        `The ${kind} has no implementation file`,
        'A registered capability must point to a regular repository file.',
        createAgentEntries(manifest),
        [
          kind === 'tool'
            ? 'MOLDEA_TOOL_IMPLEMENTATION_MISSING'
            : 'MOLDEA_SKILL_IMPLEMENTATION_MISSING',
        ],
      ),
      agentCase(
        `${kind}-implementation-present`,
        `The ${kind} implementation is connected`,
        'Core establishes file presence, not whether this implementation behaves correctly.',
        [
          ...createAgentEntries(manifest),
          {
            path: '/src/returns.ts',
            type: 'file',
            content:
              'export const explainReturns = () => "Returns are accepted within 30 days of delivery.";\n',
          },
        ],
        [],
      ),
    ];
  }),
  agentCase(
    'capability-description-missing',
    'A capability has no description',
    'Registered tools need a description explaining their purpose.',
    createAgentEntries(
      `${AGENT_MANIFEST}    tools:\n      returns:\n        name: explain_returns\n        implementation: { path: /src/returns.ts }\n`,
    ),
    ['MOLDEA_CAPABILITY_DESCRIPTION_MISSING'],
  ),
  ...(['equal', 'stale', 'missing', 'directory'] as const).map((state) =>
    agentCase(
      `mirror-${state}`,
      state === 'equal'
        ? 'Different line endings, the same instruction'
        : state === 'stale'
          ? 'The copied instruction is out of date'
          : state === 'missing'
            ? 'A declared mirror is missing'
            : 'A mirror points to a directory',
      'Mirrors are compared against the canonical instruction after text normalization.',
      [
        ...createAgentEntries(mirrorManifest),
        ...(state === 'missing'
          ? []
          : [
              state === 'directory'
                ? { path: '/instructions/support.md', type: 'directory' as const }
                : {
                    path: '/instructions/support.md',
                    type: 'file' as const,
                    content:
                      state === 'equal'
                        ? `\uFEFF${INSTRUCTION_TEXT.replaceAll('\n', '\r\n')}`
                        : `${INSTRUCTION_TEXT}Use the retired policy.\n`,
                  },
            ]),
      ],
      state === 'equal'
        ? []
        : [
            state === 'stale'
              ? 'MOLDEA_MIRROR_STALE'
              : state === 'missing'
                ? 'MOLDEA_MIRROR_MISSING'
                : 'MOLDEA_MIRROR_NOT_FILE',
          ],
    ),
  ),
  agentCase(
    'mirror-canonical-destination',
    'A mirror cannot overwrite canonical knowledge',
    'Mirror destinations must be outside the canonical directory.',
    createAgentEntries(`${AGENT_MANIFEST}    mirrors: [/moldea/project.md]\n`),
    ['MOLDEA_MIRROR_PATH_INSIDE_MOLDEA'],
  ),
  agentCase(
    'mirror-duplicate-owner',
    'A mirror is assigned twice',
    'A destination cannot have conflicting mirror ownership.',
    createAgentEntries(
      `${AGENT_MANIFEST}    mirrors: [/instructions/support.md, /instructions/support.md]\n`,
    ),
    ['MOLDEA_MIRROR_PATH_DUPLICATE'],
  ),
  ...(['present', 'empty', 'missing'] as const).map((state) =>
    agentCase(
      `runtime-guidance-${state}`,
      state === 'present'
        ? 'Runtime guidance is connected'
        : state === 'empty'
          ? 'The runtime guidance is empty'
          : 'The runtime guidance is missing',
      'Explicit runtime guidance must identify a non-empty canonical document.',
      [
        ...createAgentEntries(
          AGENT_MANIFEST.replace(
            '{ id: custom }',
            '{ id: custom, guidance: /moldea/runtimes/service.md }',
          ),
        ),
        ...(state === 'missing'
          ? []
          : [
              {
                path: '/moldea/runtimes/service.md',
                type: 'file' as const,
                content:
                  state === 'empty'
                    ? '\n'
                    : 'The service supplies the region before constructing the request.\n',
              },
            ]),
      ],
      state === 'present'
        ? []
        : [state === 'empty' ? 'MOLDEA_RUNTIME_GUIDANCE_EMPTY' : 'MOLDEA_RUNTIME_GUIDANCE_MISSING'],
    ),
  ),
  agentCase(
    'runtime-adapter-unavailable',
    'The runtime adapter is not in this composition',
    'Universal checks do not silently substitute for the requested runtime inspection.',
    createAgentEntries(AGENT_MANIFEST.replace('id: custom', 'id: openai')),
    ['MOLDEA_RUNTIME_ADAPTER_UNAVAILABLE'],
  ),
];
