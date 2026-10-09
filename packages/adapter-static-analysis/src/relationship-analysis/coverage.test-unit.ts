// @vitest-environment node
import { expect, test } from 'vitest';

import { createRelationshipCoverage, iterateDeclaredRelationships } from './coverage.js';
import type { IDeclaredRelationshipSubject, IRelationshipDeclaration } from './types.js';

const declaration: IRelationshipDeclaration = {
  bindings: {
    runtimeAgent: { path: '/agent.ts', symbol: 'agent' },
    instructionLoader: { path: '/loader.ts', symbol: 'load' },
    variableProviders: { REGION: { path: '/region.ts', symbol: 'region' } },
  },
  tools: {
    lookup: {
      implementation: { path: '/tools.ts', symbol: 'lookup' },
      registration: { path: '/tools.ts', symbol: 'lookupTool' },
    },
  },
  skills: { explain: { implementation: { path: '/explain.md' } } },
};

test('accounts for explicit outcomes and scopes pending warnings to the selected agent', () => {
  const coverage = createRelationshipCoverage(declaration, 'selected', false);
  coverage.observeEvidence({
    agentId: 'selected',
    capabilityId: null,
    capabilityKind: null,
    kind: 'runtime-pattern',
    references: [{ path: '/agent.ts', symbol: 'agent' }],
    details: {},
  });
  coverage.observeDiagnostic({
    code: 'SDK_RUNTIME_RELATIONSHIP_UNVERIFIED',
    severity: 'warning',
    entity: { agentId: 'selected', variableId: 'REGION' },
    details: { relationship: 'variable-provider' },
  });
  coverage.observeDiagnostic({
    code: 'SDK_TOOL_IMPLEMENTATION_SYMBOL_NOT_FOUND',
    severity: 'error',
    entity: { agentId: 'selected', capabilityKind: 'tool', capabilityId: 'lookup' },
    details: {},
  });
  coverage.observeEvidence({
    agentId: 'other',
    capabilityId: null,
    capabilityKind: null,
    kind: 'instruction-loader',
    references: [],
    details: {},
  });
  const pending: IDeclaredRelationshipSubject[] = [];
  coverage.finalize((subject) => pending.push(subject));
  expect(pending.map((subject) => subject.relationship)).toStrictEqual([
    'instruction-loader',
    'tool-registration',
    'skill-implementation',
  ]);
});

test.each([false, true])(
  'requires provider handler wiring for implementation proof (%s)',
  (includesHandler) => {
    const coverage = createRelationshipCoverage(declaration, 'selected', includesHandler);
    coverage.observeEvidence({
      agentId: 'selected',
      capabilityId: 'lookup',
      capabilityKind: 'tool',
      kind: 'tool-registration',
      references: [
        { path: '/tools.ts', symbol: 'lookupTool' },
        { path: '/tools.ts', symbol: 'lookup' },
      ],
      details: {},
    });
    const pending: IDeclaredRelationshipSubject[] = [];
    coverage.finalize((subject) => pending.push(subject));
    expect(pending.some((subject) => subject.relationship === 'tool-registration')).toBe(false);
    expect(pending.some((subject) => subject.relationship === 'tool-implementation')).toBe(
      !includesHandler,
    );
  },
);

test('creates no relationships for an agent with no declarations', () => {
  expect([...iterateDeclaredRelationships({})]).toStrictEqual([]);
  const pending: IDeclaredRelationshipSubject[] = [];
  createRelationshipCoverage({}, 'selected', false).finalize((subject) => pending.push(subject));
  expect(pending).toStrictEqual([]);
});

test.each(['SDK_TOOL_NAME_INVALID', 'SDK_TOOL_NAME_MISMATCH'])(
  'accounts for a contradicted registration name (%s)',
  (code) => {
    const coverage = createRelationshipCoverage(declaration, 'selected', false);
    coverage.observeDiagnostic({
      code,
      severity: 'error',
      entity: { agentId: 'selected', capabilityKind: 'tool', capabilityId: 'lookup' },
      details: {},
    });
    const pending: IDeclaredRelationshipSubject[] = [];
    coverage.finalize((subject) => pending.push(subject));
    expect(pending.some((subject) => subject.relationship === 'tool-registration')).toBe(false);
    expect(pending.some((subject) => subject.relationship === 'tool-implementation')).toBe(true);
  },
);
