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
  | 'broad-eve'
  | 'dense-eve-8'
  | 'dense-eve-16'
  | 'dense-eve-32'
  | 'dense-diagnostic'
  | 'large-source'
  | 'multi-page'
  | 'distinct-source'
  | 'over-capacity'
  | 'cyclic-alias'
  | 'deep-syntax'
  | 'large-syntax'
  | 'mixed-adapters'
  | 'imported-mutation';

export const CALIBRATION_WORKLOADS: readonly ICalibrationWorkload[] = [
  'ordinary',
  'shared-source-many-agent',
  'broad-tool',
  'deep-eve',
  'broad-eve',
  'dense-eve-8',
  'dense-eve-16',
  'dense-eve-32',
  'dense-diagnostic',
  'large-source',
  'multi-page',
  'distinct-source',
  'over-capacity',
  'cyclic-alias',
  'deep-syntax',
  'large-syntax',
  'mixed-adapters',
  'imported-mutation',
];

// fixed shipped-adapter set exercised together by the aggregate workload
export const CALIBRATION_RUNTIME_IDS = [
  'anthropic',
  'claude-agent-sdk',
  'cloudflare-agents',
  'eve',
  'google-genai',
  'langchain',
  'langgraph',
  'openai',
  'openai-agents-sdk',
  'vercel-ai-sdk',
] as const;

const loadFixture = (adapter: (typeof CALIBRATION_RUNTIME_IDS)[number]): IAdapterFixture => {
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

/** Combines reviewed providers and revisits a shared working set larger than cache capacity. */
const createMixedAdapterEntries = (largeSyntaxBytes?: number): IMemoryRepositoryEntry[] => {
  const entries: IMemoryRepositoryEntry[] = [];
  let manifest = 'version: 1\nagents:\n';
  for (const runtime of CALIBRATION_RUNTIME_IDS) {
    const fixture = loadFixture(runtime);
    const agentIds = [...fixture.manifest.matchAll(/^ {2}([a-z0-9-]+):$/gmu)].map(
      (match) => match[1]!,
    );
    const rename = (text: string): string => {
      let result = text;
      for (const id of agentIds) {
        result = result.replaceAll(`/moldea/agents/${id}/`, `/moldea/agents/${runtime}-${id}/`);
        result = result.replaceAll('`' + id + '`', '`' + runtime + '-' + id + '`');
      }
      return result.replaceAll("'../moldea/", "'../../moldea/");
    };
    let agentManifest = rename(fixture.manifest.replace(/^version: 1\nagents:\n/u, ''));
    for (const id of agentIds) {
      agentManifest = agentManifest.replace(`  ${id}:\n`, `  ${runtime}-${id}:\n`);
    }
    for (const entry of fixture.entries) {
      if (entry.path === '/moldea/project.md') continue;
      const entryPath = entry.path.startsWith('/moldea/')
        ? rename(entry.path)
        : `/${runtime}${entry.path}`;
      if (!entry.path.startsWith('/moldea/')) {
        agentManifest = agentManifest.replaceAll(entry.path, entryPath);
      }
      const placeholders = Array.from({ length: 32 }, (_, index) => `{{PADDING_${index}}}`).join(
        '\n',
      );
      const content =
        rename(entry.text) +
        (entry.path === `/moldea/agents/${agentIds[0]}/instruction.md`
          ? `\n${placeholders}\n`
          : '');
      const sourceContent =
        runtime === 'vercel-ai-sdk' &&
        entry.path === '/src/agents.ts' &&
        largeSyntaxBytes !== undefined
          ? appendDenseSyntax(content, largeSyntaxBytes)
          : content;
      entries.push({ path: entryPath, content: sourceContent, type: 'file' });
    }
    // Every provider encounters the same dense files; the second visit exposes eviction cost.
    const providers = Array.from(
      { length: 32 },
      (_, index) =>
        `        PADDING_${index}:\n          path: /shared/source${index % 16}.ts\n          symbol: provide\n`,
    ).join('');
    const variables = Array.from(
      { length: 32 },
      (_, index) =>
        `      PADDING_${index}:\n        description: Supplies calibration value ${index}.\n`,
    ).join('');
    agentManifest = agentManifest.replace(
      '    bindings:\n',
      `    variables:\n${variables}    bindings:\n      variableProviders:\n${providers}`,
    );
    manifest += agentManifest;
  }
  entries.push({
    path: '/moldea/project.md',
    content: '# Mixed runtime calibration\n',
    type: 'file',
  });
  entries.push({ path: '/moldea/moldea.yaml', content: manifest, type: 'file' });
  for (let index = 0; index < 16; index += 1) {
    entries.push({
      path: `/shared/source${index}.ts`,
      content: `export const provide = () => [${'0,'.repeat(8192)}];\n`,
      type: 'file',
    });
  }
  return entries;
};

/** Appends dense syntax immediately below a selected source-byte envelope. */
const appendDenseSyntax = (source: string, sourceBytes: number): string => {
  const remaining = sourceBytes - new TextEncoder().encode(source).byteLength - 32;
  if (!Number.isSafeInteger(sourceBytes) || remaining < 0 || sourceBytes > 8_388_608) {
    throw new TypeError('The dense-syntax workload size is outside the existing file envelope.');
  }
  return `${source}\nconst syntax = [${'0,'.repeat(Math.floor(remaining / 2))}];\n`;
};

/** Exercises registered Eve tools alongside dense agent and shared schema sources. */
const createDenseEveEntries = (toolCount: number): IMemoryRepositoryEntry[] => {
  const fixture = loadFixture('eve');
  const toolSource = fixture.entries.find((entry) => entry.path === '/agent/tools/search.ts');
  if (toolSource === undefined) throw new TypeError('The Eve tool fixture is missing.');
  const schemaReference = (symbol: string) => ({ path: '/agent/contracts.ts', symbol });
  const tools = Object.fromEntries(
    Array.from({ length: toolCount }, (_, index) => {
      const name = `tool${index.toString().padStart(3, '0')}`;
      return [
        name,
        {
          name,
          description: 'Searches the knowledge base.',
          implementation: { path: '/agent/implementations.ts', symbol: 'searchKnowledge' },
          registration: { path: `/agent/tools/${name}.ts`, symbol: 'default' },
          inputSchema: schemaReference('SearchInputSchema'),
          outputSchema: schemaReference('SearchOutputSchema'),
        },
      ];
    }),
  );
  return [
    {
      path: '/moldea/moldea.yaml',
      type: 'file',
      content: JSON.stringify({
        version: 1,
        agents: {
          support: {
            runtime: { id: 'eve' },
            bindings: {
              runtimeAgent: { path: '/agent/agent.ts', symbol: 'default' },
              instructionLoader: { path: '/agent/loaders.ts', symbol: 'loadInstruction' },
              outputSchema: schemaReference('SupportOutputSchema'),
            },
            tools,
          },
          summary: {
            runtime: { id: 'eve' },
            bindings: {
              runtimeAgent: { path: '/agent/subagents/summary/agent.ts', symbol: 'default' },
            },
          },
        },
      }),
    },
    ...fixture.entries.map((entry) => ({
      path: entry.path,
      type: entry.type,
      content: ['/agent/agent.ts', '/agent/contracts.ts'].includes(entry.path)
        ? appendDenseSyntax(entry.text, 256 * 1024)
        : entry.text,
    })),
    ...Object.keys(tools).map((name) => ({
      path: `/agent/tools/${name}.ts`,
      type: 'file' as const,
      content: appendDenseSyntax(toolSource.text, 256 * 1024),
    })),
  ];
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
  largeSyntaxBytes?: number,
): readonly IMemoryRepositoryEntry[] => {
  if (workload === 'mixed-adapters') return createMixedAdapterEntries(largeSyntaxBytes);
  if (workload.startsWith('dense-eve-'))
    return createDenseEveEntries(Number(workload.slice('dense-eve-'.length)));
  const fixture = loadFixture(
    workload === 'deep-eve' || workload === 'broad-eve' ? 'eve' : 'anthropic',
  );

  if (workload === 'shared-source-many-agent' || workload === 'multi-page') {
    addSharedAgents(fixture, 64);
  }

  if (workload === 'distinct-source' || workload === 'over-capacity') {
    addSharedAgents(fixture, 64);
    const source = fixture.entries.find((entry) => entry.path === '/src/agent.ts');
    if (source === undefined) throw new TypeError('The runtime source fixture is missing.');
    const workingSet = workload === 'distinct-source' ? 64 : 32;
    for (let index = 0; index < workingSet; index += 1) {
      fixture.entries.push({ path: `/src/source${index}.ts`, text: source.text, type: 'file' });
    }
    for (let index = 0; index < 64; index += 1) {
      const agentId = `shared${index.toString().padStart(3, '0')}`;
      fixture.manifest = fixture.manifest.replace(
        `  ${agentId}:\n    runtime:\n      id: anthropic\n    bindings:\n      runtimeAgent:\n        path: /src/agent.ts`,
        `  ${agentId}:\n    runtime:\n      id: anthropic\n    bindings:\n      runtimeAgent:\n        path: /src/source${index % workingSet}.ts`,
      );
    }
  }

  if (['cyclic-alias', 'deep-syntax', 'large-syntax'].includes(workload)) {
    const source = fixture.entries.find((entry) => entry.path === '/src/agent.ts');
    if (source === undefined) throw new TypeError('The runtime source fixture is missing.');
    if (workload === 'cyclic-alias') {
      source.text = source.text.replace('system: readInstruction()', 'system: first');
      source.text = `const first = second; const second = first;\n${source.text}`;
    } else if (workload === 'deep-syntax') {
      source.text += `\nconst nested = ${'['.repeat(256)}0${']'.repeat(256)};\n`;
    } else {
      // Dense tokens exercise AST/index allocation, rather than comment padding.
      // Stay immediately beneath the existing 8 MiB per-file envelope.
      source.text = appendDenseSyntax(source.text, largeSyntaxBytes ?? 8_388_608);
    }
  }

  if (workload === 'imported-mutation') {
    const source = fixture.entries.find((entry) => entry.path === '/src/agent.ts');
    if (source === undefined) throw new TypeError('The runtime source fixture is missing.');
    source.text += `\nregisteredFindOrder.input_schema = replacement;\n`;
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
    const registrations: string[] = [];
    const agentSource = fixture.entries.find((entry) => entry.path === '/src/agent.ts');
    const toolSource = fixture.entries.find((entry) => entry.path === '/src/find-order.ts');
    if (agentSource === undefined || toolSource === undefined)
      throw new TypeError('The tool calibration sources are missing.');
    for (let index = 0; index < 64; index += 1) {
      const toolId = `tool${index.toString().padStart(3, '0')}`;
      registrations.push(toolId);
      toolSource.text += `\nexport const ${toolId} = {type: 'custom', name: '${toolId}', description: 'Inspects ${toolId}.', input_schema: FindOrderInput, strict: true} as const;\n`;
      fixture.manifest +=
        `      ${toolId}:\n` +
        `        name: ${toolId}\n` +
        `        description: Inspects ${toolId}.\n` +
        '        implementation:\n' +
        '          path: /src/find-order.ts\n' +
        '          symbol: findOrder\n' +
        '        registration:\n          path: /src/find-order.ts\n' +
        `          symbol: ${toolId}\n` +
        '        inputSchema:\n          path: /src/contracts.ts\n          symbol: FindOrderInput\n';
    }
    agentSource.text = `import {${registrations.join(',')}} from './find-order.js';\n${agentSource.text.replace('tools: [registeredFindOrder]', `tools: [registeredFindOrder,${registrations.join(',')}]`)}`;
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

  if (workload === 'broad-eve') {
    for (let branch = 0; branch < 16; branch += 1) {
      const parent = `branch${branch.toString().padStart(2, '0')}`;
      const parentRoot = `/agent/subagents/${parent}`;
      fixture.manifest +=
        `  ${parent}:\n` +
        '    runtime:\n' +
        '      id: eve\n' +
        '    bindings:\n' +
        '      runtimeAgent:\n' +
        `        path: ${parentRoot}/agent.ts\n` +
        '        symbol: default\n';
      fixture.entries.push({
        path: `${parentRoot}/agent.ts`,
        text: "import { defineAgent } from 'eve'; export default defineAgent({ description: 'Handles a branch.', model: 'provider/model' });\n",
        type: 'file',
      });
      fixture.entries.push({
        path: `/moldea/agents/${parent}/description.md`,
        text: 'Handles a branch.\n',
        type: 'file',
      });
      fixture.entries.push({
        path: `/moldea/agents/${parent}/instruction.md`,
        text: `You are the \`${parent}\` agent.\n`,
        type: 'file',
      });

      for (let leaf = 0; leaf < 4; leaf += 1) {
        const child = `${parent}leaf${leaf}`;
        fixture.manifest +=
          `  ${child}:\n` +
          '    runtime:\n' +
          '      id: eve\n' +
          '    bindings:\n' +
          '      runtimeAgent:\n' +
          `        path: ${parentRoot}/subagents/leaf${leaf}/agent.ts\n` +
          '        symbol: default\n';
        fixture.entries.push({
          path: `${parentRoot}/subagents/leaf${leaf}/agent.ts`,
          text: "import { defineAgent } from 'eve'; export default defineAgent({ description: 'Handles a leaf.', model: 'provider/model' });\n",
          type: 'file',
        });
        fixture.entries.push({
          path: `/moldea/agents/${child}/description.md`,
          text: 'Handles a leaf.\n',
          type: 'file',
        });
        fixture.entries.push({
          path: `/moldea/agents/${child}/instruction.md`,
          text: `You are the \`${child}\` agent.\n`,
          type: 'file',
        });
      }
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
