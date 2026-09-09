import type { ICoreDiagnosticCode } from '@moldea.ai/core';
import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

import { createCoreEntries, MANIFEST_PATH, PROJECT_PATH } from './constants.ts';
import type { ICoreExampleDefinition } from './types.ts';

/** Authors a strict-manifest example without requiring a repository reader. */
const manifestCase = (
  id: string,
  title: string,
  description: string,
  content: string,
  expectedCodes: ICoreDiagnosticCode[],
): ICoreExampleDefinition => ({
  id,
  title,
  description,
  expectedCodes,
  groupId: 'structure',
  operation: 'parseManifest',
  entries: [],
  text: { path: MANIFEST_PATH, content },
});

/** Authors a complete project check with only the intended fixture variation. */
const projectCase = (
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
  groupId: 'structure',
  operation: 'validateProject',
});

// parsing and project relationships are distinct checks, not semantic evaluations
export const STRUCTURE_EXAMPLES: ICoreExampleDefinition[] = [
  ...(
    [
      [
        'utf8-invalid',
        'Invalid UTF-8 cannot become knowledge',
        'The input bytes do not encode valid UTF-8.',
        new Uint8Array([0xff]),
        'MOLDEA_TEXT_INVALID_UTF8',
      ],
      [
        'unicode-invalid',
        'An incomplete Unicode character',
        'Text must contain Unicode scalar values, not an unpaired surrogate.',
        '\uD800',
        'MOLDEA_TEXT_INVALID_UNICODE',
      ],
      [
        'nul-forbidden',
        'A forbidden NUL in the document',
        'Canonical text cannot contain a NUL character.',
        'Return\u0000policy',
        'MOLDEA_TEXT_NUL_FORBIDDEN',
      ],
    ] as const
  ).map(([id, title, description, content, code]): ICoreExampleDefinition => ({
    id,
    title,
    description,
    groupId: 'structure',
    operation: 'normalizeText',
    entries: [],
    text: { path: PROJECT_PATH, content },
    expectedCodes: [code],
  })),
  manifestCase(
    'manifest-valid',
    'A readable project map',
    'The manifest uses the supported format.',
    'version: 1\n',
    [],
  ),
  manifestCase(
    'manifest-malformed',
    'An unfinished declaration',
    'The YAML document cannot be parsed.',
    'version: [\n',
    ['MOLDEA_YAML_MALFORMED'],
  ),
  manifestCase(
    'manifest-duplicate-key',
    'Two versions in one file',
    'A duplicate key cannot silently override the first declaration.',
    'version: 1\nversion: 1\n',
    ['MOLDEA_YAML_DUPLICATE_KEY'],
  ),
  manifestCase(
    'manifest-version',
    'An unsupported format',
    'This Core composition does not interpret the requested major version.',
    'version: 2\n',
    ['MOLDEA_MANIFEST_VERSION_UNSUPPORTED'],
  ),
  manifestCase(
    'manifest-unknown-property',
    'A misspelled field',
    'Unknown manifest properties are reported.',
    'version: 1\nagent: {}\n',
    ['MOLDEA_MANIFEST_PROPERTY_UNKNOWN'],
  ),
  manifestCase(
    'manifest-type',
    'The wrong kind of value',
    'Agent declarations must use the expected mapping structure.',
    'version: 1\nagents: []\n',
    ['MOLDEA_MANIFEST_VALUE_INVALID'],
  ),
  manifestCase(
    'manifest-invalid-id',
    'An invalid identifier',
    'Agent IDs follow the repository format naming rules.',
    'version: 1\nagents:\n  Support: { runtime: { id: custom } }\n',
    ['MOLDEA_ID_INVALID'],
  ),
  manifestCase(
    'manifest-reserved-id',
    'A reserved filename',
    'Reserved filesystem names cannot become agent IDs.',
    'version: 1\nagents:\n  con: { runtime: { id: custom } }\n',
    ['MOLDEA_ID_RESERVED'],
  ),
  manifestCase(
    'manifest-path',
    'A path leaves its root',
    'A logical reference cannot traverse outside the repository.',
    'version: 1\ncontext:\n  /moldea/project.md:\n    bindings: [{ path: /../policy.ts }]\n',
    ['MOLDEA_PATH_INVALID'],
  ),
  manifestCase(
    'manifest-glob',
    'A malformed impact pattern',
    'Patterns have a defined grammar rather than arbitrary filesystem matching.',
    'version: 1\ncontext:\n  /moldea/project.md:\n    affectedBy: ["/src/[policy].ts"]\n',
    ['MOLDEA_GLOB_INVALID'],
  ),
  manifestCase(
    'manifest-duplicate-path',
    'The same path twice',
    'Repeated exact impact declarations are identified.',
    'version: 1\ncontext:\n  /moldea/project.md:\n    affectedBy: [/src/policy.ts, /src/policy.ts]\n',
    ['MOLDEA_PATH_DUPLICATE'],
  ),
  manifestCase(
    'manifest-duplicate-pattern',
    'The same pattern twice',
    'Repeated impact patterns are identified.',
    'version: 1\ncontext:\n  /moldea/project.md:\n    affectedBy: [/src/**, /src/**]\n',
    ['MOLDEA_PATTERN_DUPLICATE'],
  ),
  manifestCase(
    'binding-canonical-symbol',
    'A symbol on a document',
    'Canonical document references cannot claim source-code symbols.',
    'version: 1\ncontext:\n  /moldea/project.md:\n    bindings: [{ path: /moldea/context/returns.md, symbol: policy }]\n',
    ['MOLDEA_SYMBOL_FORBIDDEN'],
  ),
  projectCase(
    'foundation-missing',
    'The project foundation is absent',
    'The canonical project document is required.',
    createCoreEntries().filter(({ path }) => path !== PROJECT_PATH),
    ['MOLDEA_PROJECT_FILE_MISSING'],
  ),
  projectCase(
    'manifest-missing',
    'The project map is absent',
    'The canonical manifest is required.',
    createCoreEntries().filter(({ path }) => path !== MANIFEST_PATH),
    ['MOLDEA_MANIFEST_MISSING'],
  ),
  projectCase(
    'canonical-unrecognized',
    'An unexpected canonical file',
    'The knowledge directory has a defined layout.',
    createCoreEntries('version: 1\n', [
      { path: '/moldea/notes.txt', type: 'file', content: 'Return policy notes.\n' },
    ]),
    ['MOLDEA_CANONICAL_PATH_UNRECOGNIZED'],
  ),
  projectCase(
    'canonical-entry-type',
    'A directory where a file belongs',
    'Canonical assets must have the expected entry type.',
    [
      { path: MANIFEST_PATH, type: 'directory' },
      { path: PROJECT_PATH, type: 'file', content: 'Returns service.\n' },
    ],
    ['MOLDEA_ENTRY_TYPE_INVALID'],
  ),
  ...(['connected', 'missing', 'directory'] as const).map((state) =>
    projectCase(
      `policy-reference-${state}`,
      state === 'connected'
        ? 'The policy is connected'
        : state === 'missing'
          ? 'The referenced policy is missing'
          : 'The reference points to a directory',
      'A declared source connection must resolve to a regular repository file.',
      createCoreEntries(
        'version: 1\ncontext:\n  /moldea/project.md:\n    bindings: [{ path: /src/returns/policy.ts }]\n',
        state === 'missing'
          ? []
          : [
              state === 'directory'
                ? { path: '/src/returns/policy.ts', type: 'directory' }
                : {
                    path: '/src/returns/policy.ts',
                    type: 'file',
                    content:
                      'export const canReturn = (daysSinceDelivery: number) => daysSinceDelivery <= 30;\n',
                  },
            ],
      ),
      state === 'connected'
        ? []
        : [state === 'missing' ? 'MOLDEA_REFERENCE_MISSING' : 'MOLDEA_REFERENCE_NOT_FILE'],
    ),
  ),
  projectCase(
    'exact-impact-missing',
    'An exact impact path is missing',
    'Unlike a glob, an exact affected path must exist.',
    createCoreEntries(
      'version: 1\ncontext:\n  /moldea/project.md:\n    affectedBy: [/src/returns/policy.ts]\n',
    ),
    ['MOLDEA_IMPACT_PATH_MISSING'],
  ),
  projectCase(
    'exact-impact-directory',
    'An exact impact path is a directory',
    'Exact impact paths identify files, not directory selections.',
    createCoreEntries(
      'version: 1\ncontext:\n  /moldea/project.md:\n    affectedBy: [/src/returns]\n',
      [{ path: '/src/returns', type: 'directory' }],
    ),
    ['MOLDEA_IMPACT_PATH_NOT_FILE'],
  ),
];
