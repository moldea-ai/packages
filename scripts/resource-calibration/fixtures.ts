import { readFileSync } from 'node:fs';

import type { IMemoryRepositoryEntry } from '../../projects/repository/src/memory.ts';

interface IAdapterFixture {
  manifest: string;
  entries: { path: string; text: string; type: 'file' }[];
}

export type ICalibrationWorkload =
  | 'ordinary'
  | 'shared-source-many-agent'
  | 'broad-tool'
  | 'deep-eve'
  | 'dense-diagnostic'
  | 'large-source'
  | 'multi-page';

export const CALIBRATION_WORKLOADS: readonly ICalibrationWorkload[] = [
  'ordinary',
  'shared-source-many-agent',
  'broad-tool',
  'deep-eve',
  'dense-diagnostic',
  'large-source',
  'multi-page',
];

const loadFixture = (adapter: 'anthropic' | 'eve'): IAdapterFixture => {
  const fixture = JSON.parse(
    readFileSync(new URL(`../../fixtures/adapter-${adapter}/cases.json`, import.meta.url), 'utf8'),
  ) as IAdapterFixture;

  if (
    typeof fixture.manifest !== 'string' ||
    !Array.isArray(fixture.entries) ||
    fixture.entries.some(
      (entry) =>
        entry.type !== 'file' || typeof entry.path !== 'string' || typeof entry.text !== 'string',
    )
  ) {
    throw new TypeError(`The ${adapter} calibration fixture is invalid.`);
  }

  return fixture;
};

const addSharedAgents = (fixture: IAdapterFixture, count: number): void => {
  for (let index = 0; index < count; index += 1) {
    const agentId = `shared${index.toString().padStart(3, '0')}`;
    fixture.manifest +=
      `  ${agentId}:\n` +
      '    runtime:\n' +
      '      id: anthropic\n' +
      '    bindings:\n' +
      '      runtimeAgent:\n' +
      '        path: /src/agent.ts\n' +
      '        symbol: supportAgent\n' +
      '      instructionLoader:\n' +
      '        path: /src/instructions.ts\n' +
      '        symbol: loadInstruction\n';
    fixture.entries.push({
      path: `/moldea/agents/${agentId}/description.md`,
      text: `Shared-source agent ${agentId}.\n`,
      type: 'file',
    });
    fixture.entries.push({
      path: `/moldea/agents/${agentId}/instruction.md`,
      text: `You are the \`${agentId}\` agent.\n`,
      type: 'file',
    });
  }
};

/** Creates one fixed, repository-neutral synthetic workload from reviewed adapter fixtures. */
export const createCalibrationEntries = (
  workload: ICalibrationWorkload,
): readonly IMemoryRepositoryEntry[] => {
  const fixture = loadFixture(workload === 'deep-eve' ? 'eve' : 'anthropic');

  if (workload === 'shared-source-many-agent' || workload === 'multi-page') {
    addSharedAgents(fixture, 64);
  }

  if (workload === 'dense-diagnostic') {
    addSharedAgents(fixture, 64);
    const agentSource = fixture.entries.find((entry) => entry.path === '/src/agent.ts');

    if (agentSource === undefined || !agentSource.text.includes('system: readInstruction()')) {
      throw new TypeError('The Anthropic request fixture changed.');
    }

    agentSource.text = agentSource.text.replace(
      'system: readInstruction()',
      'system: dynamicSystem',
    );
  }

  if (workload === 'broad-tool') {
    for (let index = 0; index < 64; index += 1) {
      const toolId = `tool${index.toString().padStart(3, '0')}`;
      fixture.manifest +=
        `      ${toolId}:\n` +
        `        name: ${toolId}\n` +
        `        description: Inspects ${toolId}.\n` +
        '        implementation:\n' +
        '          path: /src/find-order.ts\n' +
        '          symbol: findOrder\n';
    }
  }

  if (workload === 'large-source') {
    const agentSource = fixture.entries.find((entry) => entry.path === '/src/agent.ts');

    if (agentSource === undefined) {
      throw new TypeError('The Anthropic source fixture is missing.');
    }

    agentSource.text += `\n/*${' source-padding'.repeat(16_384)} */\n`;
  }

  if (workload === 'deep-eve') {
    for (let depth = 1; depth <= 16; depth += 1) {
      const directory = Array.from(
        { length: depth },
        (_, index) => `n${index.toString().padStart(2, '0')}`,
      ).join('/');
      fixture.entries.push({
        path: `/agent/subagents/${directory}/agent.ts`,
        text: `export const nested${depth} = ${depth};\n`,
        type: 'file',
      });
    }
  }

  return [
    { path: '/moldea/moldea.yaml', content: fixture.manifest, type: 'file' },
    ...fixture.entries.map((entry) => ({
      path: entry.path,
      content: entry.text,
      type: entry.type,
    })),
  ];
};
