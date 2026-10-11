import type { IMemoryRepositoryEntry } from '../../projects/repository/src/memory.ts';

// repository-neutral workloads retained for the packed CLI's bounded inspection checks
export const NODE_CALIBRATION_WORKLOADS = [
  'ordinary',
  'shared-source-many-agent',
  'broad-tool',
  'dense-diagnostic',
  'large-source',
  'multi-page',
  'distinct-source',
  'deep-syntax',
  'large-syntax',
  'large-comment',
  'large-template',
  'large-regex',
  'large-jsx',
  'large-function-comment',
  'maximum-diagnostic',
] as const;
export type ICalibrationWorkload = (typeof NODE_CALIBRATION_WORKLOADS)[number];

const INTEGRATION_TEMPLATE =
  '<!-- moldea:start -->\nnode "<repo-root>/{{skill-path}}/scripts/relevance-gate.mjs" --repository "<repo-root>"\n<!-- moldea:end -->\n';

const file = (path: string, content: string): IMemoryRepositoryEntry => ({
  path,
  content,
  type: 'file',
});

/** Fills a referenced source with valid low-density syntax at the existing file envelope. */
const appendLowDensitySyntax = (source: string, workload: ICalibrationWorkload): string => {
  const delimiters: Partial<Record<ICalibrationWorkload, [string, string]>> = {
    'large-comment': ['\n/*', '*/\n'],
    'large-template': ['\nconst padding = `', '`;\n'],
    'large-regex': ['\nconst padding = /', '/;\n'],
    'large-jsx': ['\nconst padding = <span>', '</span>;\n'],
    'large-function-comment': ['\nfunction padding() { /*', '*/ }\n'],
  };
  const selected = delimiters[workload];
  if (selected === undefined) throw new TypeError('The low-density workload is invalid.');
  const [prefix, suffix] = selected;
  return (
    source + prefix + 'x'.repeat(8_388_608 - Buffer.byteLength(source + prefix + suffix)) + suffix
  );
};

/** Creates bounded universal binding fixtures without loading a runtime SDK or repository code. */
export const createCalibrationEntries = (
  workload: ICalibrationWorkload,
  largeSyntaxBytes = 4_194_304,
): readonly IMemoryRepositoryEntry[] => {
  if (
    !Number.isSafeInteger(largeSyntaxBytes) ||
    largeSyntaxBytes < 1024 ||
    largeSyntaxBytes > 8_388_608
  )
    throw new TypeError('The dense-syntax workload size is outside the existing file envelope.');
  const entries = [
    file('/moldea/project.md', '# Project\n'),
    file('/AGENTS.md', INTEGRATION_TEMPLATE.replaceAll('{{skill-path}}', '.agents/skills/moldea')),
    file('/.agents/skills/moldea/SKILL.md', '# Skill\n'),
    file('/.agents/skills/moldea/scripts/relevance-gate.mjs', '// Gate\n'),
    file('/.agents/skills/moldea/assets/managed-agents-block.md', INTEGRATION_TEMPLATE),
  ];
  if (workload === 'maximum-diagnostic')
    return [
      ...entries,
      file(
        '/moldea/moldea.yaml',
        JSON.stringify({
          version: 1,
          context: Object.fromEntries(
            Array.from({ length: 10_000 }, (_, index) => [
              `/moldea/context/missing-${index}.md`,
              {},
            ]),
          ),
        }),
      ),
    ];
  const sourcePath = workload === 'large-jsx' ? '/src/agent.tsx' : '/src/agent.ts';
  let source = 'export const supportAgent = () => null;\n';
  if (workload === 'dense-diagnostic') source = 'export const otherAgent = () => null;\n';
  if (workload === 'large-source') source += '/*' + 'x'.repeat(1024 * 1024) + '*/\n';
  if (workload === 'deep-syntax')
    source += 'const deep = ' + '('.repeat(4096) + '0' + ')'.repeat(4096) + ';\n';
  if (workload === 'large-syntax')
    source +=
      'const syntax = [' +
      '0,'.repeat(Math.floor((largeSyntaxBytes - Buffer.byteLength(source) - 32) / 2)) +
      '];\n';
  if (workload.startsWith('large-') && !['large-source', 'large-syntax'].includes(workload))
    source = appendLowDensitySyntax(source, workload);
  entries.push(file(sourcePath, source));
  const agents: Record<string, unknown> = {};
  const count = [
    'shared-source-many-agent',
    'multi-page',
    'distinct-source',
    'dense-diagnostic',
  ].includes(workload)
    ? 64
    : 1;
  for (let index = 0; index < count; index += 1) {
    const id = `support${index.toString().padStart(3, '0')}`;
    const referencePath = workload === 'distinct-source' ? `/src/agent${index}.ts` : sourcePath;
    if (workload === 'distinct-source') entries.push(file(referencePath, source));
    agents[id] = {
      runtime: { id: 'openai' },
      bindings: { runtimeAgent: { path: referencePath, symbol: 'supportAgent' } },
      ...(workload === 'broad-tool'
        ? {
            tools: Object.fromEntries(
              Array.from({ length: 64 }, (_, toolIndex) => {
                const name = `tool${toolIndex}`;
                return [
                  name,
                  {
                    name,
                    description: 'Returns the fixture result.',
                    implementation: { path: referencePath, symbol: 'supportAgent' },
                  },
                ];
              }),
            ),
          }
        : {}),
    };
    entries.push(file(`/moldea/agents/${id}/description.md`, 'Support agent.\n'));
    entries.push(file(`/moldea/agents/${id}/instruction.md`, `You are the \`${id}\` agent.\n`));
  }
  entries.push(file('/moldea/moldea.yaml', JSON.stringify({ version: 1, agents })));
  return entries;
};
