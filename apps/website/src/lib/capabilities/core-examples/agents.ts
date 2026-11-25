import type { IDiagnostic } from '@moldea.ai/core';
import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

import {
  AGENT_MANIFEST,
  createAgentEntries,
  createCoreEntries,
  INSTRUCTION_PATH,
  INSTRUCTION_TEXT,
  PROJECT_PATH,
  PROJECT_TEXT,
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
  expectedCodes: IDiagnostic['code'][],
): ICoreExampleDefinition => ({
  id,
  title,
  description,
  entries,
  expectedCodes,
  groupId: 'agents',
  operation: 'validateProject',
});

const agentFieldsPrefix = AGENT_MANIFEST.replace(' {}', '');
const mirrorManifest = `${agentFieldsPrefix}    mirrors:\n      - /instructions/support.md\n`;

// canonical instructions, declared assets, and mirrors remain independent of runtime execution
export const AGENT_EXAMPLES: ICoreExampleDefinition[] = [
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
        ...createAgentEntries(`${agentFieldsPrefix}    context: [/moldea/context/returns.md]\n`),
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
    'The canonical description and instruction are both present, and the instruction introduces the registered agent.',
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
    'A copied instruction names the wrong agent',
    'The support agent still introduces itself as sales.',
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
    'A description is blank',
    'The canonical description must contain text.',
    replaceFile('/moldea/agents/support/description.md', '\n'),
    ['MOLDEA_AGENT_DESCRIPTION_INVALID'],
  ),
  ...(['tool', 'skill'] as const).flatMap((kind) => {
    const manifest = `${agentFieldsPrefix}    ${kind}s:\n      returns:\n        name: explain_returns\n        description: Explains return eligibility using the current policy.\n        implementation:\n          path: /src/returns.ts\n`;
    return [
      agentCase(
        `${kind}-description-invalid`,
        `The ${kind} description starts with a space`,
        'Capability descriptions must begin and end with non-whitespace text.',
        createAgentEntries(
          manifest.replace(
            'Explains return eligibility using the current policy.',
            "' Explains return eligibility.'",
          ),
        ),
        ['MOLDEA_CAPABILITY_DESCRIPTION_INVALID'],
      ),
      agentCase(
        `${kind}-implementation-missing`,
        `The ${kind} has no implementation file`,
        `The ${kind} is declared, but the code file it points to is missing.`,
        createAgentEntries(
          kind === 'tool'
            ? manifest.replace('name: explain_returns', 'name: check_return_eligibility')
            : manifest,
        ),
        [
          kind === 'tool'
            ? 'MOLDEA_TOOL_IMPLEMENTATION_MISSING'
            : 'MOLDEA_SKILL_IMPLEMENTATION_MISSING',
        ],
      ),
      agentCase(
        `${kind}-implementation-present`,
        `The declared ${kind} file exists`,
        'Core checks the declared implementation file. Runtime wiring remains outside this check.',
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
      `${agentFieldsPrefix}    tools:\n      returns:\n        name: explain_returns\n        implementation:\n          path: /src/returns.ts\n`,
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
      state === 'stale'
        ? 'The original says 60 days. The stale copy still says 30.'
        : 'Mirrors are compared against the canonical instruction after text normalization.',
      [
        ...createAgentEntries(mirrorManifest).map((entry) => {
          if (state !== 'stale') return entry;
          if (entry.path === INSTRUCTION_PATH)
            return {
              ...entry,
              type: 'file' as const,
              content: `${INSTRUCTION_TEXT}Accept returns within 60 days of delivery.\n`,
            };
          if (entry.path === PROJECT_PATH)
            return {
              ...entry,
              type: 'file' as const,
              content: PROJECT_TEXT.replace('30 days', '60 days'),
            };
          return entry;
        }),
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
                        : `${INSTRUCTION_TEXT}Accept returns within 30 days of delivery.\n`,
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
    createAgentEntries(`${agentFieldsPrefix}    mirrors:\n      - /moldea/project.md\n`),
    ['MOLDEA_MIRROR_PATH_INSIDE_MOLDEA'],
  ),
  agentCase(
    'mirror-duplicate-owner',
    'A mirror is assigned twice',
    'A destination cannot have conflicting mirror ownership.',
    createAgentEntries(
      `${agentFieldsPrefix}    mirrors:\n      - /instructions/support.md\n      - /instructions/support.md\n`,
    ),
    ['MOLDEA_MIRROR_PATH_DUPLICATE'],
  ),
];
