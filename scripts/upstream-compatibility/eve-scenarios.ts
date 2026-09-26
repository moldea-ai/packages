import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

import type { IUpstreamTarget } from './types.ts';

const execFileAsync = promisify(execFile);

const writeScenarioFile = async (root: string, path: string, source: string): Promise<void> => {
  const target = join(root, ...path.split('/'));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, source);
};

const getRecords = (source: unknown, name: string): readonly Record<string, unknown>[] => {
  if (typeof source !== 'object' || source === null || !(name in source)) {
    throw new TypeError(`The Eve compiler artifact has no ${name} collection.`);
  }

  const records = (source as Record<string, unknown>)[name];

  if (
    !Array.isArray(records) ||
    records.some((record) => typeof record !== 'object' || record === null)
  ) {
    throw new TypeError(`The Eve compiler artifact has an invalid ${name} collection.`);
  }

  return records as Record<string, unknown>[];
};

const requireNames = (
  records: readonly Record<string, unknown>[],
  expected: readonly string[],
  label: string,
): void => {
  const names = records.map(({ name }) => name).sort();

  if (JSON.stringify(names) !== JSON.stringify([...expected].sort())) {
    throw new Error(`The Eve compiler did not produce the expected ${label} names.`);
  }
};

const BASE_AGENT =
  "import { defineAgent } from 'eve'; export default defineAgent({ description: 'Supports requests.', model: 'openai/gpt-4.1' });\n";
const CHILD_AGENT =
  "import { defineAgent } from 'eve'; export default defineAgent({ description: 'Handles a delegated request.', model: 'openai/gpt-4.1' });\n";

const prepareBaseAgent = async (root: string): Promise<void> => {
  await writeScenarioFile(root, 'agent/agent.ts', BASE_AGENT);
  await writeScenarioFile(root, 'agent/instructions.md', 'Support requests.\n');
};

const prepareScenario = async (root: string, target: IUpstreamTarget): Promise<string | null> => {
  await writeScenarioFile(
    root,
    'package.json',
    JSON.stringify({
      name: `moldea-eve-${target.fixture}`,
      private: true,
      type: 'module',
      dependencies: { eve: target.version },
    }),
  );

  if (target.fixture === 'current') {
    await writeScenarioFile(root, 'agents/support/agent/agent.ts', BASE_AGENT);
    await writeScenarioFile(root, 'agents/support/agent/instructions.md', 'Support requests.\n');
    await writeScenarioFile(
      root,
      'agents/support/agent/subagents/specialist.ts',
      "import { defineWorkspaceAgent } from 'eve'; export default defineWorkspaceAgent({ name: 'research' });\n",
    );
    await writeScenarioFile(root, 'agents/support/agent/subagents/summary/agent.ts', CHILD_AGENT);
    await writeScenarioFile(
      root,
      'agents/support/agent/subagents/summary/subagents/deep/agent.ts',
      CHILD_AGENT,
    );
    await writeScenarioFile(
      root,
      'agents/support/agent/tools/workflow.ts',
      "import { defineWorkflowTool } from 'eve/tools'; import { z } from 'zod'; import { runWorkflow } from '../implementations.js'; export default defineWorkflowTool({ availableInSubagents: false, description: 'Returns a result.', execution: 'background', inputSchema: z.object({}), execute: runWorkflow });\n",
    );
    await writeScenarioFile(
      root,
      'agents/support/agent/implementations.ts',
      "export async function runWorkflow() { 'use workflow'; return { ok: true }; }\n",
    );
    await writeScenarioFile(
      root,
      'agents/research/agent/agent.ts',
      "import { defineAgent } from 'eve'; export default defineAgent({ description: 'Researches requests.', model: 'openai/gpt-4.1' });\n",
    );
    await writeScenarioFile(root, 'agents/research/agent/instructions.md', 'Research requests.\n');
    return 'support';
  }

  await prepareBaseAgent(root);

  if (target.fixture === 'agent-options-boundary') {
    await writeScenarioFile(
      root,
      'agent/agent.ts',
      "import { defineAgent } from 'eve'; export default defineAgent({ defaultTools: false, model: 'openai/gpt-4.1' });\n",
    );
  } else if (target.fixture === 'visibility-boundary') {
    await writeScenarioFile(
      root,
      'agent/subagents/summary/agent.ts',
      "import { defineAgent } from 'eve'; export default defineAgent({ description: 'Handles a delegated request.', model: 'openai/gpt-4.1', tool: false });\n",
    );
  } else if (target.fixture === 'minimum') {
    await writeScenarioFile(root, 'agent/subagents/summary/agent.ts', CHILD_AGENT);
    await writeScenarioFile(root, 'agent/subagents/summary/subagents/deep/agent.ts', CHILD_AGENT);
  } else if (target.fixture === 'exposure-before' || target.fixture === 'exposure-boundary') {
    await writeScenarioFile(
      root,
      'agent/tools/exposure.ts',
      `import { defineTool } from 'eve/tools'; import { z } from 'zod'; export default defineTool({ ${target.fixture === 'exposure-boundary' ? 'availableInSubagents: false, ' : ''}description: 'Returns a result.', inputSchema: z.object({}), async execute() { return { ok: true }; } });\n`,
    );
  } else if (target.fixture === 'defaults-boundary') {
    await writeScenarioFile(root, 'agent/subagents/todo/agent.ts', CHILD_AGENT);
    await writeScenarioFile(root, 'agent/subagents/ask_question/agent.ts', CHILD_AGENT);
  } else if (target.fixture === 'exclusion-boundary') {
    await writeScenarioFile(
      root,
      'agent/tools/valid.ts',
      "import { defineTool } from 'eve/tools'; import { z } from 'zod'; export default defineTool({ description: 'Returns a result.', inputSchema: z.object({}), async execute() { return { ok: true }; } });\n",
    );
    await writeScenarioFile(root, 'agent/tools/ignored.test.ts', 'export default (\n');
    await writeScenarioFile(root, 'agent/tools/__tests__/ignored.ts', 'export default (\n');
    await writeScenarioFile(root, 'agent/subagents/ignored.test.ts', 'export default (\n');
    await writeScenarioFile(root, 'agent/subagents/__tests__/agent.ts', 'export default (\n');
  } else {
    throw new TypeError('The Eve upstream fixture is unsupported.');
  }

  return null;
};

/** Compiles real pinned Eve layouts without invoking a model or provider. */
export const checkEveCompilerScenario = async (
  directory: string,
  target: IUpstreamTarget,
): Promise<void> => {
  const root = join(directory, 'eve-scenario');
  const selectedAgent = await prepareScenario(root, target);
  const cli = join(directory, 'node_modules', 'eve', 'bin', 'eve.js');
  await execFileAsync(
    process.execPath,
    [cli, 'info', ...(selectedAgent === null ? [] : ['--agent', selectedAgent])],
    { cwd: root, maxBuffer: 2_097_152, timeout: 120_000 },
  );

  const compiledPath =
    selectedAgent === null
      ? join(root, '.eve', 'compile', 'compiled-agent-manifest.json')
      : join(root, 'agents', selectedAgent, '.eve', 'compile', 'compiled-agent-manifest.json');
  const compiled = JSON.parse(await readFile(compiledPath, 'utf8')) as unknown;
  const subagents = getRecords(compiled, 'subagents');
  const tools = getRecords(compiled, 'tools');

  if (target.fixture === 'agent-options-boundary') {
    if (tools.some(({ name }) => name === 'bash')) {
      throw new Error('Eve did not honor the defaultTools option.');
    }
  } else if (target.fixture === 'visibility-boundary') {
    requireNames(subagents, ['summary'], 'callable hidden subagent');
  } else if (target.fixture === 'minimum') {
    requireNames(subagents, ['summary', 'deep'], 'nested subagent');
  } else if (target.fixture === 'exposure-before' || target.fixture === 'exposure-boundary') {
    const exposure = tools.find(({ name }) => name === 'exposure');
    if (
      exposure === undefined ||
      (target.fixture === 'exposure-boundary' && exposure['availableInSubagents'] !== false)
    ) {
      throw new Error('Eve did not compile the expected tool exposure declaration.');
    }
  } else if (target.fixture === 'defaults-boundary') {
    requireNames(subagents, ['todo', 'ask_question'], 'removed-default subagent');
  } else if (target.fixture === 'exclusion-boundary') {
    if (
      !tools.some(({ name }) => name === 'valid') ||
      tools.some(({ name }) => name === 'ignored') ||
      subagents.length !== 0
    ) {
      throw new Error('Eve did not exclude test-file tool and subagent sources.');
    }
  } else {
    requireNames(subagents, ['summary', 'deep'], 'nested subagent');
    const peers = getRecords(compiled, 'remoteAgents');
    requireNames(peers, ['specialist'], 'workspace peer');
    const workflowTool = tools.find(({ name }) => name === 'workflow');
    const behavior = workflowTool?.['behavior'];
    const handling =
      typeof behavior === 'object' && behavior !== null && 'handling' in behavior
        ? behavior.handling
        : null;

    if (
      workflowTool?.['availableInSubagents'] !== false ||
      typeof handling !== 'object' ||
      handling === null ||
      !('kind' in handling) ||
      handling.kind !== 'workflow-tool'
    ) {
      throw new Error('Eve did not compile the scoped workflow tool exposure.');
    }
  }
};
