// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '../repository.test-fixtures.js';

import type { IRuntimeAdapterContext, IRuntimeAdapterEvidence } from '../adapter/index.js';
import { createCore, type ICoreResourceLimits } from '../index.js';

import { createRuntimeAdapterResultCollector } from './collection.js';

const sourcePath = parseRepositoryPath('/src/runtime.ts');

const createRepository = () =>
  createMemoryRepositoryReader([
    {
      content:
        'version: 1\nagents:\n  alpha:\n    runtime:\n      id: openai\n  beta:\n    runtime:\n      id: openai\n',
      path: '/moldea/moldea.yaml',
      type: 'file',
    },
    { content: '# Project\n', path: '/moldea/project.md', type: 'file' },
    ...['alpha', 'beta'].flatMap((id) => [
      {
        content: 'A runtime agent.\n',
        path: `/moldea/agents/${id}/description.md`,
        type: 'file' as const,
      },
      {
        content: `You are the \`${id}\` agent.\n`,
        path: `/moldea/agents/${id}/instruction.md`,
        type: 'file' as const,
      },
    ]),
    { content: 'export const runtime = {};\n', path: sourcePath, type: 'file' },
  ]);

const createEvidence = (context: IRuntimeAdapterContext): IRuntimeAdapterEvidence => ({
  agentId: context.agent.id,
  capabilityId: null,
  capabilityKind: null,
  details: {},
  kind: 'runtime-pattern',
  references: [{ path: sourcePath }],
  runtimeName: null,
  source: 'openai',
});

describe('adapter output admission through Core', () => {
  test('deduplicated records still consume the raw allowance of later invocations', async () => {
    const budgets: unknown[] = [];
    const core = createCore({
      adapters: [
        {
          id: 'openai',
          inspect: (context) => {
            budgets.push(context.outputBudget);
            const collector = createRuntimeAdapterResultCollector(context);
            const count = context.agent.id === 'alpha' ? 2 : 1;
            for (let index = 0; index < count; index += 1) {
              collector.evidence.add(() => createEvidence(context));
            }
            return Promise.resolve(collector.finalize());
          },
          supportedRepositoryFormatVersions: [1],
        },
      ],
      limits: { maxDiagnostics: 2, maxEvidence: 3 },
    });

    const result = await core.validateProject({ repository: createRepository() });
    expect(result.valid).toBe(true);
    expect(result.evidence).toHaveLength(2);
    expect(budgets).toStrictEqual([
      { diagnostics: { maximum: 2, remaining: 2 }, evidence: { maximum: 3, remaining: 3 } },
      { diagnostics: { maximum: 2, remaining: 2 }, evidence: { maximum: 3, remaining: 1 } },
    ]);
    expect(Object.isFrozen(budgets[0])).toBe(true);
  });

  test.each(['diagnostics', 'evidence'] as const)(
    'rejects exhausted %s admission before executing its factory',
    async (kind) => {
      const rejectedFactory = vi.fn((): never => {
        throw new TypeError('The rejected factory executed.');
      });
      const limit: keyof ICoreResourceLimits =
        kind === 'diagnostics' ? 'maxDiagnostics' : 'maxEvidence';
      const core = createCore({
        adapters: [
          {
            id: 'openai',
            inspect: (context) => {
              const collector = createRuntimeAdapterResultCollector(context);
              if (context.agent.id === 'alpha') {
                for (let index = 0; index < 2; index += 1) {
                  if (kind === 'evidence') {
                    collector.evidence.add(() => createEvidence(context));
                  } else {
                    collector.diagnostics.add(() => ({
                      code: 'OPENAI_TEST_ERROR',
                      details: {},
                      entity: { agentId: context.agent.id },
                      message: 'A controlled adapter failure.',
                      path: sourcePath,
                      pointer: null,
                      range: null,
                      severity: 'error',
                      source: 'openai',
                    }));
                  }
                }
              } else {
                collector[kind].add(rejectedFactory);
              }
              return Promise.resolve(collector.finalize());
            },
            supportedRepositoryFormatVersions: [1],
          },
        ],
        limits: { [limit]: 2 },
      });

      await expect(core.validateProject({ repository: createRepository() })).rejects.toMatchObject({
        adapterId: 'openai',
        code: 'RESOURCE_LIMIT_EXCEEDED',
        limit,
        limitMaximum: 2,
        nextAction: 'reduce-input-or-increase-limit',
        observedUsage: 3,
      });
      expect(rejectedFactory).not.toHaveBeenCalled();
    },
  );

  test('empty results remain valid after an earlier invocation uses the complete allowance', async () => {
    const core = createCore({
      adapters: [
        {
          id: 'openai',
          inspect: (context) => {
            const collector = createRuntimeAdapterResultCollector(context);
            if (context.agent.id === 'alpha') {
              collector.evidence.add(() => createEvidence(context));
            } else {
              expect(context.outputBudget.evidence.remaining).toBe(0);
            }
            return Promise.resolve(collector.finalize());
          },
          supportedRepositoryFormatVersions: [1],
        },
      ],
      limits: { maxEvidence: 1 },
    });
    await expect(core.validateProject({ repository: createRepository() })).resolves.toMatchObject({
      runtimeInspection: 'complete',
      valid: true,
    });
  });

  test('cancellation remains an operational failure and never executes the next factory', async () => {
    const controller = new AbortController();
    const factory = vi.fn((): never => {
      throw new TypeError('The canceled factory executed.');
    });
    const core = createCore({
      adapters: [
        {
          id: 'openai',
          inspect: (context) => {
            const collector = createRuntimeAdapterResultCollector(context);
            controller.abort();
            collector.evidence.add(factory);
            return Promise.resolve(collector.finalize());
          },
          supportedRepositoryFormatVersions: [1],
        },
      ],
    });

    await expect(
      core.validateProject({ repository: createRepository(), signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'ABORTED' });
    expect(factory).not.toHaveBeenCalled();
  });
});
